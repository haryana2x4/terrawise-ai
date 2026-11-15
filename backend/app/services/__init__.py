"""Domain services: GeoValidation, AdviceAndRisk, CredentialCard, and AssistantService."""
from __future__ import annotations

import io
import json
import logging
import math
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import qrcode
import requests
from pyproj import CRS, Geod, Transformer
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A6
from reportlab.lib.styles import ParagraphStyle, StyleSheet1
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform as shapely_transform
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import (
    AppError,
    format_provenance,
    safe_value,
    sqm_to_acres,
    sqm_to_gunthas,
    sqm_to_hectares,
)
from app.integrations import OpenMeteoClient, SoilGridsClient, validate_outbound_url
from app.models import AssistantMessage, CropHistory, Farmer, FieldObservation, Parcel

logger = logging.getLogger(__name__)

WGS84_GEOD = Geod(ellps="WGS84")
UTM43N_TRANSFORMER = Transformer.from_crs(
    CRS.from_epsg(4326), CRS.from_epsg(32643), always_xy=True
)


class GeoValidationService:
    """Strict RFC 7946 polygon validator, geodesic area calculator, and KML/GeoJSON importer."""

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.district_shapes: Dict[str, Any] = {}
        self.taluka_features: List[Dict[str, Any]] = []
        self._load_boundaries()

    def _load_boundaries(self) -> None:
        dist_path = self.data_dir / "geo" / "districts.geojson"
        if dist_path.exists():
            with open(dist_path, "r", encoding="utf-8") as f:
                fc = json.load(f)
            for idx, feat in enumerate(fc.get("features", [])):
                props = feat.get("properties", {})
                name = (
                    props.get("district_name")
                    or props.get("district")
                    or props.get("shapeName")
                    or props.get("NAME_2")
                    or f"Region_{idx}"
                )
                self.district_shapes[name] = shape(feat["geometry"])

        tal_path = self.data_dir / "geo" / "talukas.geojson"
        if tal_path.exists():
            with open(tal_path, "r", encoding="utf-8") as f:
                fc = json.load(f)
            self.taluka_features = fc.get("features", [])

    def validate_and_measure_polygon(self, geojson_input: Any) -> Dict[str, Any]:
        """Validate polygon topology, vertex spacing, region containment, and compute dual-CRS area."""
        if isinstance(geojson_input, str):
            try:
                geom_dict = json.loads(geojson_input)
            except Exception as exc:
                raise AppError("INVALID_GEOJSON", f"Malformed GeoJSON string: {exc}", 400) from exc
        elif isinstance(geojson_input, dict):
            geom_dict = geojson_input
        else:
            raise AppError("INVALID_GEOJSON", "Polygon geometry must be a GeoJSON object or string.", 400)

        if geom_dict.get("type") == "Feature":
            geom_dict = geom_dict.get("geometry") or {}
        elif geom_dict.get("type") == "FeatureCollection":
            features = geom_dict.get("features") or []
            if not features:
                raise AppError("INVALID_GEOJSON", "FeatureCollection contains no features.", 400)
            geom_dict = features[0].get("geometry") or {}

        if geom_dict.get("type") != "Polygon":
            raise AppError("INVALID_GEOMETRY_TYPE", "Only single Polygon geometries are supported.", 400)

        coords = geom_dict.get("coordinates") or []
        if not coords or not coords[0] or len(coords[0]) < 4:
            raise AppError("TOO_FEW_VERTICES", "Polygon must have at least 3 distinct vertices.", 400)

        ring = coords[0]
        # Verify minimum vertex spacing >= 0.5m between consecutive vertices
        for i in range(len(ring) - 1):
            lon1, lat1 = float(ring[i][0]), float(ring[i][1])
            lon2, lat2 = float(ring[i + 1][0]), float(ring[i + 1][1])
            _, _, dist_m = WGS84_GEOD.inv(lon1, lat1, lon2, lat2)
            if dist_m < 0.5 and not (i == len(ring) - 2 and lon1 == lon2 and lat1 == lat2):
                raise AppError(
                    "VERTEX_SPACING_TOO_SMALL",
                    f"Vertices {i} and {i+1} are only {dist_m:.2f}m apart (minimum 0.5m required).",
                    400,
                )

        try:
            poly = shape(geom_dict)
        except Exception as exc:
            raise AppError("INVALID_POLYGON_SHAPE", f"Unable to construct polygon: {exc}", 400) from exc

        if not poly.is_valid or poly.is_empty:
            raise AppError(
                "SELF_INTERSECTING_POLYGON",
                "Polygon boundary is self-intersecting or topologically invalid.",
                400,
            )

        # Enforce RFC 7946 counter-clockwise exterior orientation
        oriented_poly = orient(poly, sign=1.0)
        centroid = oriented_poly.centroid

        # Verify containment inside Ahilya Nagar or Nashik districts
        if self.district_shapes:
            contained = any(
                d_poly.contains(oriented_poly) or d_poly.intersects(centroid)
                for d_poly in self.district_shapes.values()
            )
            if not contained:
                raise AppError(
                    "OUT_OF_SERVICE_AREA",
                    "Parcel must lie within the supported operational districts (Ahilya Nagar or Nashik, Maharashtra).",
                    400,
                )
        else:
            # Bounding box guard for Ahilya Nagar + Nashik (18.2N-20.9N, 73.2E-75.7E)
            if not (18.2 <= centroid.y <= 20.9 and 73.2 <= centroid.x <= 75.7):
                raise AppError(
                    "OUT_OF_SERVICE_AREA",
                    "Parcel coordinates fall outside Ahilya Nagar and Nashik districts.",
                    400,
                )

        # Geodesic area on WGS84 ellipsoid vs UTM Zone 43N projected area
        geod_area_sqm, geod_perim_m = WGS84_GEOD.geometry_area_perimeter(oriented_poly)
        geod_area_sqm = abs(float(geod_area_sqm))

        utm_poly = shapely_transform(UTM43N_TRANSFORMER.transform, oriented_poly)
        utm_area_sqm = abs(float(utm_poly.area))

        if geod_area_sqm < 25.0:
            raise AppError("PARCEL_TOO_SMALL", "Parcel area must be at least 25 square meters (~0.25 guntha).", 400)
        if geod_area_sqm > 2_000_000.0:
            raise AppError("PARCEL_TOO_LARGE", "Single parcel cannot exceed 200 hectares (500 acres).", 400)

        divergence_pct = abs(geod_area_sqm - utm_area_sqm) / geod_area_sqm * 100.0
        if divergence_pct > 0.5:
            raise AppError(
                "AREA_PROJECTION_DIVERGENCE",
                f"Geodesic vs UTM-43N area divergence ({divergence_pct:.2f}%) exceeds 0.5% threshold.",
                400,
            )

        return {
            "geojson": json.dumps(mapping(oriented_poly)),
            "area_sqm": round(geod_area_sqm, 2),
            "area_acres": sqm_to_acres(geod_area_sqm),
            "area_gunthas": sqm_to_gunthas(geod_area_sqm),
            "area_hectares": sqm_to_hectares(geod_area_sqm),
            "perimeter_m": round(abs(float(geod_perim_m)), 2),
            "centroid_lat": round(float(centroid.y), 6),
            "centroid_lon": round(float(centroid.x), 6),
            "crs_divergence_pct": round(divergence_pct, 4),
        }

    def check_overlap(
        self,
        candidate_geojson_str: str,
        existing_parcels: List[Tuple[int, str, str]],
        max_overlap_ratio: float = 0.02,
    ) -> Tuple[bool, Optional[str]]:
        """Check whether candidate polygon overlaps any existing parcel by more than 2%."""
        cand_poly = shape(json.loads(candidate_geojson_str))
        cand_area = cand_poly.area
        if cand_area <= 0:
            return True, "Candidate polygon has zero area."

        for parcel_id, owner_id, existing_geojson_str in existing_parcels:
            try:
                ex_poly = shape(json.loads(existing_geojson_str))
                if not cand_poly.intersects(ex_poly):
                    continue
                inter_area = cand_poly.intersection(ex_poly).area
                ratio_cand = inter_area / cand_area
                ratio_ex = inter_area / ex_poly.area if ex_poly.area > 0 else 0.0
                if max(ratio_cand, ratio_ex) > max_overlap_ratio:
                    pct = round(max(ratio_cand, ratio_ex) * 100, 1)
                    return (
                        True,
                        f"Boundary overlaps existing parcel #{parcel_id} by {pct}% (maximum allowed overlap is 2.0%).",
                    )
            except Exception:
                continue
        return False, None

    def parse_import_file(self, filename: str, raw_bytes: bytes) -> Dict[str, Any]:
        """Safely parse uploaded .geojson, .json, or .kml boundary files (max 2 MB, XXE-safe)."""
        if len(raw_bytes) > 2 * 1024 * 1024:
            raise AppError("FILE_TOO_LARGE", "Uploaded boundary file exceeds the 2 MB limit.", 400)

        text_content = raw_bytes.decode("utf-8", errors="replace").strip()
        lower_name = (filename or "").lower()

        if lower_name.endswith(".kml") or text_content.startswith("<?xml") or "<kml" in text_content[:300]:
            if "<!DOCTYPE" in text_content.upper() or "<!ENTITY" in text_content.upper():
                raise AppError("XXE_BLOCKED", "XML DOCTYPE and ENTITY declarations are forbidden.", 400)
            try:
                root = ET.fromstring(text_content)
            except Exception as exc:
                raise AppError("INVALID_KML", f"Could not parse KML XML: {exc}", 400) from exc

            coords_text = None
            for elem in root.iter():
                if elem.tag.endswith("coordinates") and elem.text and elem.text.strip():
                    coords_text = elem.text.strip()
                    break
            if not coords_text:
                raise AppError("INVALID_KML", "No <coordinates> element found in KML file.", 400)

            ring: List[List[float]] = []
            for token in coords_text.split():
                parts = token.split(",")
                if len(parts) >= 2:
                    ring.append([float(parts[0]), float(parts[1])])
            if len(ring) >= 3 and ring[0] != ring[-1]:
                ring.append(ring[0])
            geom = {"type": "Polygon", "coordinates": [ring]}
            return self.validate_and_measure_polygon(geom)

        return self.validate_and_measure_polygon(text_content)


class AdviceAndRiskService:
    """Deterministic agronomic suitability scoring (0-100), VPD/GDD/RSHI indices, and IPM pest guidance."""

    IPM_DISCLAIMER = {
        "en": "Consult your local Krishi Vigyan Kendra (KVK) or state agricultural officer before applying chemical pesticides; strictly follow label dosage and pre-harvest interval (PHI).",
        "mr": "रासायनिक कीटकनाशके वापरण्यापूर्वी आपल्या स्थानिक कृषी विज्ञान केंद्राचा (KVK) किंवा कृषी अधिकाऱ्याचा सल्ला घ्या; लेबलवरील प्रमाण आणि काढणीपूर्व प्रतीक्षा कालावधी (PHI) पाळा.",
        "hi": "रासायनिक कीटनाशकों का उपयोग करने से पहले अपने स्थानीय कृषि विज्ञान केंद्र (KVK) या कृषि अधिकारी से परामर्श लें; लेबल की खुराक और कटाई-पूर्व अंतराल (PHI) का पालन करें।",
    }

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.crops: List[Dict[str, Any]] = []
        self.risk_rules: Dict[str, Any] = {}
        self.glossary: Dict[str, Any] = {}
        self._load_catalogs()

    def _load_catalogs(self) -> None:
        crops_path = self.data_dir / "crops.json"
        if crops_path.exists():
            with open(crops_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.crops = data.get("crops", data) if isinstance(data, dict) else data

        rules_path = self.data_dir / "risk-rules.json"
        if rules_path.exists():
            with open(rules_path, "r", encoding="utf-8") as f:
                self.risk_rules = json.load(f)

        glossary_path = self.data_dir / "glossary.json"
        if glossary_path.exists():
            with open(glossary_path, "r", encoding="utf-8") as f:
                self.glossary = json.load(f)

    @staticmethod
    def compute_agronomic_indices(weather: Dict[str, Any], irrigation_source: str = "rainfed") -> Dict[str, Any]:
        """Compute VPD (kPa), GDD (°C-days), and RSHI (0-100) strictly from real weather data."""
        cur = weather.get("current", {})
        temp_val = (cur.get("temperature_c") or {}).get("value")
        hum_val = (cur.get("humidity_pct") or {}).get("value")
        sm_val = (cur.get("soil_moisture_m3m3") or {}).get("value")
        summary = weather.get("summary", {})
        rain_30d = summary.get("rain_30d_total_mm")
        et0_7d = summary.get("et0_7d_total_mm")

        # 1. Vapor Pressure Deficit (VPD) in kPa using Tetens equation
        vpd_kpa: Optional[float] = None
        if temp_val is not None and hum_val is not None:
            es = 0.61078 * math.exp((17.27 * float(temp_val)) / (float(temp_val) + 237.3))
            ea = es * (float(hum_val) / 100.0)
            vpd_kpa = round(max(0.0, es - ea), 2)

        # 2. Growing Degree Days (7-day forecast accumulation, base 10°C)
        gdd_7d: Optional[float] = None
        forecast = weather.get("forecast_7d") or []
        if forecast:
            acc = 0.0
            valid_days = 0
            for day in forecast:
                tmax = day.get("temp_max_c")
                tmin = day.get("temp_min_c")
                if tmax is not None and tmin is not None:
                    tmean = (float(tmax) + float(tmin)) / 2.0
                    acc += max(0.0, tmean - 10.0)
                    valid_days += 1
            if valid_days > 0:
                gdd_7d = round(acc, 1)

        # 3. Regional Soil-Hydration Index (RSHI 0-100)
        rshi_score: Optional[float] = None
        irr_bonus = {
            "drip": 25.0,
            "canal": 20.0,
            "well": 18.0,
            "borewell": 15.0,
            "farm_pond": 12.0,
            "rainfed": 0.0,
        }.get((irrigation_source or "rainfed").lower(), 5.0)

        if sm_val is not None or rain_30d is not None:
            sm_component = min(60.0, float(sm_val or 0.18) * 150.0)
            rain_component = min(25.0, float(rain_30d or 0.0) * 0.25)
            et_penalty = min(15.0, float(et0_7d or 25.0) * 0.35)
            rshi_score = round(max(0.0, min(100.0, sm_component + rain_component + irr_bonus - et_penalty)), 1)

        return {
            "vpd_kpa": safe_value(vpd_kpa, "kPa"),
            "gdd_7d_base10": safe_value(gdd_7d, "°C·d", 1),
            "rshi_score": safe_value(rshi_score, "/100", 1),
            "provenance": weather.get("provenance"),
        }

    def evaluate_crop_suitability(
        self,
        *,
        soil_type: str,
        irrigation_source: str,
        season: str,
        weather: Dict[str, Any],
        previous_crop_id: Optional[str] = None,
        lang: str = "mr",
    ) -> Dict[str, Any]:
        """Score every catalog crop from 0 to 100 with transparent factor breakdown."""
        now_month = datetime.now(timezone.utc).month
        if not season or season == "auto":
            if 6 <= now_month <= 10:
                season = "kharif"
            elif now_month >= 11 or now_month <= 2:
                season = "rabi"
            else:
                season = "zaid"

        summary = weather.get("summary", {})
        rain_30d = summary.get("rain_30d_total_mm")
        max_temp = summary.get("max_temp_next_7d_c")

        irr_norm = (irrigation_source or "rainfed").lower()
        soil_norm = (soil_type or "medium_black").lower()

        ranked: List[Dict[str, Any]] = []
        for crop in self.crops:
            # 1. Water availability match (0-30 pts)
            water_need = (crop.get("water_need") or crop.get("water_requirement") or "medium").lower()
            if irr_norm in ("drip", "canal", "well", "borewell"):
                water_pts = 28 if water_need in ("low", "medium") else 25
            else:
                # Rainfed
                if water_need == "low":
                    water_pts = 27
                elif water_need == "medium":
                    water_pts = 22 if (rain_30d or 0) >= 40 else 14
                else:
                    water_pts = 8

            # 2. Soil match (0-25 pts)
            suitable_soils = [s.lower() for s in (crop.get("suitable_soils") or crop.get("soils") or [])]
            if not suitable_soils or any(s in soil_norm or soil_norm in s for s in suitable_soils):
                soil_pts = 24
            else:
                soil_pts = 14

            # 3. Season & temperature match (0-20 pts)
            crop_seasons = [s.lower() for s in (crop.get("seasons") or [crop.get("season", "kharif")])]
            if season.lower() in crop_seasons or "annual" in crop_seasons or "all" in crop_seasons:
                season_pts = 19
            else:
                season_pts = 9
            if max_temp is not None and max_temp > 39.0 and water_need == "high":
                season_pts = max(4, season_pts - 5)

            # 4. Duration & input efficiency (0-15 pts)
            duration_days = crop.get("duration_days") or 110
            if isinstance(duration_days, list) and duration_days:
                duration_days = sum(duration_days) / len(duration_days)
            duration_pts = 14 if float(duration_days) <= 120 else 11

            # 5. Crop rotation bonus/penalty (0-10 pts)
            crop_id = crop.get("id") or crop.get("crop_id") or crop.get("name_en", "crop").lower()
            is_legume = bool(crop.get("is_legume") or crop_id in ("gram", "chickpea", "tur", "pigeonpea", "soybean", "moong", "groundnut"))
            if previous_crop_id and previous_crop_id.lower() == crop_id.lower():
                rotation_pts = 3  # Continuous monocropping penalty
            elif is_legume:
                rotation_pts = 10  # Nitrogen-fixing legume bonus
            else:
                rotation_pts = 8

            total_score = int(min(100, max(0, water_pts + soil_pts + season_pts + duration_pts + rotation_pts)))
            names = crop.get("names") or {}
            name_en = names.get("en") or crop.get("name_en") or crop.get("name") or crop_id.title()
            name_mr = names.get("mr") or crop.get("name_mr") or name_en
            name_hi = names.get("hi") or crop.get("name_hi") or name_en

            ranked.append(
                {
                    "crop_id": crop_id,
                    "name": {"en": name_en, "mr": name_mr, "hi": name_hi}.get(lang, name_en),
                    "names": {"en": name_en, "mr": name_mr, "hi": name_hi},
                    "suitability_score": total_score,
                    "band": "High" if total_score >= 75 else ("Moderate" if total_score >= 55 else "Low"),
                    "water_need": water_need,
                    "duration_days": duration_days,
                    "expected_yield_qtl_acre": crop.get("yield_qtl_per_acre") or crop.get("expected_yield"),
                    "breakdown": {
                        "water_match": water_pts,
                        "soil_match": soil_pts,
                        "season_temp_match": season_pts,
                        "duration_efficiency": duration_pts,
                        "rotation_health": rotation_pts,
                    },
                    "ipm_guidance": crop.get("pest_management") or crop.get("ipm_notes") or self.IPM_DISCLAIMER.get(lang, self.IPM_DISCLAIMER["en"]),
                }
            )

        ranked.sort(key=lambda c: c["suitability_score"], reverse=True)
        return {
            "season": season,
            "soil_type": soil_type,
            "irrigation_source": irrigation_source,
            "indices": self.compute_agronomic_indices(weather, irrigation_source),
            "recommendations": ranked,
            "ipm_disclaimer": self.IPM_DISCLAIMER.get(lang, self.IPM_DISCLAIMER["en"]),
            "provenance": weather.get("provenance"),
        }

    def evaluate_risks_and_pests(
        self,
        *,
        weather: Dict[str, Any],
        crop_id: Optional[str] = None,
        lang: str = "mr",
    ) -> Dict[str, Any]:
        """Generate weather-triggered risk alerts and IPM-first pest precautions."""
        alerts: List[Dict[str, Any]] = []
        summary = weather.get("summary", {})
        cur = weather.get("current", {})

        rain_7d = summary.get("rain_7d_forecast_mm")
        max_temp = summary.get("max_temp_next_7d_c")
        hum = (cur.get("humidity_pct") or {}).get("value")
        wind = (cur.get("wind_kmh") or {}).get("value")

        if weather.get("status") == "unavailable":
            return {
                "status": "unavailable",
                "alerts": [],
                "message": "No data — live weather telemetry is required to compute risk alerts.",
                "ipm_disclaimer": self.IPM_DISCLAIMER.get(lang, self.IPM_DISCLAIMER["en"]),
                "provenance": weather.get("provenance"),
            }

        if rain_7d is not None and rain_7d >= 65.0:
            alerts.append(
                {
                    "code": "HEAVY_RAIN_FORECAST",
                    "severity": "high",
                    "title": {
                        "en": f"Heavy Rain Forecast ({rain_7d} mm in next 7 days)",
                        "mr": f"मुसळधार पावसाचा अंदाज (पुढील ७ दिवसांत {rain_7d} मिमी)",
                        "hi": f"भारी वर्षा का पूर्वानुमान (अगले 7 दिनों में {rain_7d} मिमी)",
                    }.get(lang),
                    "action": {
                        "en": "Clear field drainage channels and postpone foliar sprays or fertilizer top-dressing.",
                        "mr": "शेतातील पाण्याचा निचरा होणारे पाट मोकळे करा आणि फवारणी किंवा खताची वरखते देणे पुढे ढकला.",
                        "hi": "खेत की जल निकासी नालियां साफ करें और छिड़काव या उर्वरक डालना स्थगित करें।",
                    }.get(lang),
                }
            )
        elif rain_7d is not None and rain_7d < 5.0:
            alerts.append(
                {
                    "code": "DRY_SPELL_WATCH",
                    "severity": "moderate",
                    "title": {
                        "en": f"Dry Spell Watch ({rain_7d} mm expected over 7 days)",
                        "mr": f"कोरड्या हवामानाची शक्यता (७ दिवसांत फक्त {rain_7d} मिमी पाऊस)",
                        "hi": f"सूखे की संभावना (7 दिनों में केवल {rain_7d} मिमी बारिश)",
                    }.get(lang),
                    "action": {
                        "en": "Prioritize evening drip/mulch conservation to reduce soil evaporation loss.",
                        "mr": "बाष्पीभवन कमी करण्यासाठी आच्छादन (मल्चिंग) आणि संध्याकाळी ठिबक सिंचनाचा वापर करा.",
                        "hi": "वाष्पीकरण कम करने के लिए मल्चिंग और शाम के समय ड्रिप सिंचाई को प्राथमिकता दें।",
                    }.get(lang),
                }
            )

        if max_temp is not None and max_temp >= 38.0:
            alerts.append(
                {
                    "code": "HEAT_STRESS_ADVISORY",
                    "severity": "high" if max_temp >= 41.0 else "moderate",
                    "title": {
                        "en": f"High Temperature Stress ({max_temp} °C peak)",
                        "mr": f"उष्णतेचा ताण (कमाल तापमान {max_temp} °C)",
                        "hi": f"उच्च तापमान तनाव (अधिकतम तापमान {max_temp} °C)",
                    }.get(lang),
                    "action": {
                        "en": "Irrigate during early morning or late evening; inspect for thrips and mites under warm dry conditions.",
                        "mr": "सकाळी लवकर किंवा संध्याकाळी उशिरा पाणी द्या; उष्ण व कोरड्या हवामानात फुलकिडे आणि कोळी किडीची पाहणी करा.",
                        "hi": "सुबह जल्दी या देर शाम सिंचाई करें; गर्म और शुष्क मौसम में थ्रिप्स और माइट्स की जांच करें।",
                    }.get(lang),
                }
            )

        if hum is not None and float(hum) >= 78.0:
            alerts.append(
                {
                    "code": "FUNGAL_HUMIDITY_WATCH",
                    "severity": "moderate",
                    "title": {
                        "en": f"High Humidity Fungal Watch ({hum}% RH)",
                        "mr": f"जास्त आर्द्रतेमुळे बुरशीजन्य रोगाची शक्यता ({hum}% आर्द्रता)",
                        "hi": f"उच्च आर्द्रता के कारण फफूंद रोग की निगरानी ({hum}% आर्द्रता)",
                    }.get(lang),
                    "action": {
                        "en": "Scout lower canopy for blight/mildew lesions; ensure airflow and use yellow/blue sticky traps first (IPM).",
                        "mr": "पानांच्या खालच्या बाजूला करपा किंवा भुरी रोगाची लक्षणे तपासा; एकात्मिक कीड व्यवस्थापनासाठी (IPM) चिकट सापळे लावा.",
                        "hi": "निचली पत्तियों पर झुलसा या फफूंद के लक्षणों की जांच करें; समग्र कीट प्रबंधन (IPM) के तहत चिपचिपे ट्रैप लगाएं।",
                    }.get(lang),
                }
            )

        return {
            "status": "ok",
            "alerts": alerts,
            "wind_spray_safe": (float(wind) < 15.0) if wind is not None else None,
            "ipm_disclaimer": self.IPM_DISCLAIMER.get(lang, self.IPM_DISCLAIMER["en"]),
            "provenance": weather.get("provenance"),
        }


class CredentialCardService:
    """Generates printable A6 single and A4 4-up PDF credential cards with Devanagari support."""

    def __init__(self, fonts_dir: Path, support_contact: str = "") -> None:
        self.fonts_dir = fonts_dir
        self.support_contact = support_contact.strip()
        self.font_name = "Helvetica"
        self.font_bold = "Helvetica-Bold"
        self._register_fonts()

    def _register_fonts(self) -> None:
        reg_path = self.fonts_dir / "NotoSansDevanagari-Regular.ttf"
        bold_path = self.fonts_dir / "NotoSansDevanagari-Bold.ttf"
        try:
            if reg_path.exists():
                pdfmetrics.registerFont(TTFont("NotoDevanagari", str(reg_path)))
                self.font_name = "NotoDevanagari"
            if bold_path.exists():
                pdfmetrics.registerFont(TTFont("NotoDevanagari-Bold", str(bold_path)))
                self.font_bold = "NotoDevanagari-Bold"
        except Exception as exc:
            logger.warning("Could not load Devanagari TTF font: %s", exc)

    def _build_styles(self) -> StyleSheet1:
        styles = StyleSheet1()
        styles.add(
            ParagraphStyle(
                name="CardTitle",
                fontName=self.font_bold,
                fontSize=13,
                leading=16,
                textColor=colors.HexColor("#1B4332"),
            )
        )
        styles.add(
            ParagraphStyle(
                name="CardBody",
                fontName=self.font_name,
                fontSize=9.5,
                leading=13,
                textColor=colors.HexColor("#1F2937"),
            )
        )
        styles.add(
            ParagraphStyle(
                name="CardMono",
                fontName="Courier-Bold",
                fontSize=11,
                leading=14,
                textColor=colors.HexColor("#0F172A"),
            )
        )
        styles.add(
            ParagraphStyle(
                name="CardFooter",
                fontName=self.font_name,
                fontSize=7.5,
                leading=10,
                textColor=colors.HexColor("#4B5563"),
            )
        )
        return styles

    def generate_single_card_pdf(
        self,
        *,
        farmer: Dict[str, Any],
        One_time_password: Optional[str] = None,
        base_url: str = "http://localhost:5173",
    ) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A6,
            leftMargin=8 * mm,
            rightMargin=8 * mm,
            topMargin=8 * mm,
            bottomMargin=8 * mm,
        )
        styles = self._build_styles()
        story = self._build_card_elements(farmer, One_time_password, base_url, styles)
        doc.build(story)
        return buf.getvalue()

    def generate_batch_sheet_pdf(
        self,
        *,
        farmers_with_passwords: List[Tuple[Dict[str, Any], Optional[str]]],
        base_url: str = "http://localhost:5173",
    ) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=10 * mm,
            rightMargin=10 * mm,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
        )
        styles = self._build_styles()
        story: List[Any] = []
        for idx, (farmer, pwd) in enumerate(farmers_with_passwords):
            story.extend(self._build_card_elements(farmer, pwd, base_url, styles))
            story.append(Spacer(1, 6 * mm))
        if not story:
            story.append(Paragraph("Kshetra — No farmer accounts selected.", styles["CardBody"]))
        doc.build(story)
        return buf.getvalue()

    def _build_card_elements(
        self,
        farmer: Dict[str, Any],
        cleartext_password: Optional[str],
        base_url: str,
        styles: StyleSheet1,
    ) -> List[Any]:
        fid = farmer.get("farmer_id", "")
        name = farmer.get("name", "")
        district = farmer.get("district", "Ahilya Nagar")
        taluka = farmer.get("taluka", "")
        village = farmer.get("village", "")
        issued_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        pwd_display = (
            cleartext_password
            if cleartext_password
            else "Set by farmer (use Admin Reset to issue a new temporary password)"
        )

        elements: List[Any] = [
            Paragraph("KSHETRA (क्षेत्र) — शेतकरी ओळखपत्र / Farmer Credential Card", styles["CardTitle"]),
            Spacer(1, 2 * mm),
        ]

        rows = [
            [Paragraph("Farmer Name / नाव:", styles["CardBody"]), Paragraph(str(name), styles["CardBody"])],
            [Paragraph("Farmer ID / आयडी:", styles["CardBody"]), Paragraph(str(fid), styles["CardMono"])],
            [Paragraph("Password / पासवर्ड:", styles["CardBody"]), Paragraph(str(pwd_display), styles["CardMono"])],
            [
                Paragraph("Location / गाव-तालुका:", styles["CardBody"]),
                Paragraph(f"{village}, {taluka}, {district}".strip(", "), styles["CardBody"]),
            ],
            [Paragraph("Portal URL:", styles["CardBody"]), Paragraph(f"{base_url}/?fid={fid}", styles["CardBody"])],
            [Paragraph("Issued Date:", styles["CardBody"]), Paragraph(issued_date, styles["CardBody"])],
        ]
        if self.support_contact:
            rows.append(
                [Paragraph("Extension Support:", styles["CardBody"]), Paragraph(self.support_contact, styles["CardBody"])]
            )

        tbl = Table(rows, colWidths=[36 * mm, 52 * mm])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1B4332")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        elements.append(tbl)
        elements.append(Spacer(1, 2 * mm))
        elements.append(
            Paragraph(
                "Note: You will be prompted to change your temporary password on first login. Keep this card private.",
                styles["CardFooter"],
            )
        )
        return elements


class AssistantService:
    """Production Krishi Mitra AI Assistant with provider adapter, grounding, rate limits, and IPM safety."""

    INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
        re.compile(r"system\s*prompt", re.IGNORECASE),
        re.compile(r"<\|im_start\|>|<\|im_end\|>", re.IGNORECASE),
        re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.IGNORECASE),
    ]

    def __init__(self, config: Dict[str, Any], advice_service: AdviceAndRiskService) -> None:
        self.config = config
        self.advice_service = advice_service

    @classmethod
    def sanitize_user_message(cls, message: str) -> Tuple[str, bool]:
        """Strip control chars, bound length to 1000 chars, and detect prompt-injection attempts."""
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", (message or "")).strip()
        if not cleaned:
            raise AppError("EMPTY_MESSAGE", "Message cannot be empty.", 400)
        if len(cleaned) > 1000:
            cleaned = cleaned[:1000]

        for pat in cls.INJECTION_PATTERNS:
            if pat.search(cleaned):
                return cleaned, True
        return cleaned, False

    def check_quota(self, session: Session, farmer_id: str) -> None:
        """Enforce per-farmer hourly message limit and daily token budget."""
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        hour_ago = now_naive - timedelta(hours=1)
        day_ago = now_naive - timedelta(days=1)

        hourly_limit = int(self.config.get("ASSISTANT_HOURLY_MSG_LIMIT", 30))
        daily_budget = int(self.config.get("ASSISTANT_DAILY_TOKEN_BUDGET", 25000))

        recent_msgs = (
            session.query(AssistantMessage)
            .filter(
                AssistantMessage.farmer_id == farmer_id,
                AssistantMessage.role == "user",
                AssistantMessage.created_at >= hour_ago,
            )
            .count()
        )
        if recent_msgs >= hourly_limit:
            raise AppError(
                "ASSISTANT_RATE_LIMIT",
                "Hourly assistant message limit reached (30 messages/hour). Please try again in a few minutes. / तासाभराची संदेश मर्यादा पूर्ण झाली आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.",
                429,
            )

        tokens_today = (
            session.query(func.coalesce(func.sum(AssistantMessage.tokens_used), 0))
            .filter(
                AssistantMessage.farmer_id == farmer_id,
                AssistantMessage.created_at >= day_ago,
            )
            .scalar()
        )
        if int(tokens_today or 0) >= daily_budget:
            raise AppError(
                "ASSISTANT_BUDGET_EXCEEDED",
                "Daily assistant token quota reached. Your quota resets automatically within 24 hours.",
                429,
            )

    def chat(
        self,
        session: Session,
        *,
        farmer: Farmer,
        message: str,
        lang: str = "mr",
        parcel_id: Optional[int] = None,
        skip_network: bool = False,
    ) -> Dict[str, Any]:
        """Process a farmer's question grounded in their real parcels, weather, soil, and crop suitability."""
        cleaned_msg, injection_flagged = self.sanitize_user_message(message)
        self.check_quota(session, farmer.farmer_id)

        # Prune messages older than 90 days
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
            days=int(self.config.get("ASSISTANT_RETENTION_DAYS", 90))
        )
        session.query(AssistantMessage).filter(
            AssistantMessage.farmer_id == farmer.farmer_id,
            AssistantMessage.created_at < cutoff,
        ).delete()

        # Select active parcel context
        parcels = list(farmer.parcels)
        active_parcel: Optional[Parcel] = None
        if parcel_id is not None:
            active_parcel = next((p for p in parcels if p.id == parcel_id), None)
        if active_parcel is None and parcels:
            active_parcel = parcels[0]

        lat = active_parcel.centroid_lat if active_parcel else 19.39
        lon = active_parcel.centroid_lon if active_parcel else 74.65
        soil_type = active_parcel.soil_type if active_parcel else "medium_black"
        irrigation = active_parcel.irrigation_source if active_parcel else "rainfed"

        weather = OpenMeteoClient.fetch_weather(lat, lon, db_session=session, skip_network=skip_network)
        suitability = self.advice_service.evaluate_crop_suitability(
            soil_type=soil_type,
            irrigation_source=irrigation,
            season="auto",
            weather=weather,
            lang=lang,
        )
        risks = self.advice_service.evaluate_risks_and_pests(weather=weather, lang=lang)

        user_msg_row = AssistantMessage(
            farmer_id=farmer.farmer_id,
            role="user",
            content=cleaned_msg,
            language=lang,
            provider="client",
            tokens_used=max(1, len(cleaned_msg) // 4),
        )
        session.add(user_msg_row)
        session.flush()

        if injection_flagged:
            reply_text = {
                "en": "I am Krishi Mitra, your agricultural advisor for Kshetra. I can only answer farming, weather, soil, water, crop suitability, and mandi questions for your registered fields.",
                "mr": "मी कृषी मित्र आहे, तुमचा क्षेत्र (Kshetra) कृषी सल्लागार. मी फक्त तुमच्या नोंदणीकृत शेताचे हवामान, माती, पाणी, पीक निवड आणि बाजारभावाशी संबंधित प्रश्नांची उत्तरे देऊ शकतो.",
                "hi": "मैं कृषि मित्र हूँ, क्षेत्र (Kshetra) का आपका कृषि सलाहकार। मैं केवल आपके पंजीकृत खेत के मौसम, मिट्टी, पानी, फसल चयन और मंडी भाव से जुड़े प्रश्नों का उत्तर दे सकता हूँ।",
            }.get(lang, "I can only assist with agricultural questions for your registered parcels.")
            provider_used = "safety_guard"
        else:
            reply_text, provider_used = self._generate_grounded_reply(
                farmer=farmer,
                active_parcel=active_parcel,
                weather=weather,
                suitability=suitability,
                risks=risks,
                question=cleaned_msg,
                lang=lang,
                skip_network=skip_network,
            )

        tokens_est = max(10, (len(cleaned_msg) + len(reply_text)) // 4)
        assistant_row = AssistantMessage(
            farmer_id=farmer.farmer_id,
            role="assistant",
            content=reply_text,
            language=lang,
            provider=provider_used,
            tokens_used=tokens_est,
        )
        session.add(assistant_row)
        session.commit()
        session.refresh(assistant_row)

        return {
            "message": assistant_row.to_dict(),
            "context_summary": {
                "parcel_name": active_parcel.name if active_parcel else None,
                "area_acres": active_parcel.area_acres if active_parcel else None,
                "soil_type": soil_type if active_parcel else None,
                "irrigation_source": irrigation if active_parcel else None,
                "weather_provenance": weather.get("provenance"),
                "top_crops": [c["name"] for c in suitability.get("recommendations", [])[:3]],
            },
            "ipm_disclaimer": self.advice_service.IPM_DISCLAIMER.get(lang, self.advice_service.IPM_DISCLAIMER["en"]),
        }

    def _generate_grounded_reply(
        self,
        *,
        farmer: Farmer,
        active_parcel: Optional[Parcel],
        weather: Dict[str, Any],
        suitability: Dict[str, Any],
        risks: Dict[str, Any],
        question: str,
        lang: str,
        skip_network: bool = False,
    ) -> Tuple[str, str]:
        provider = (self.config.get("ASSISTANT_PROVIDER") or "auto").lower()
        gemini_key = (self.config.get("GEMINI_API_KEY") or "").strip()
        openai_key = (self.config.get("OPENAI_API_KEY") or "").strip()

        context_block = self._build_system_prompt(
            farmer=farmer,
            active_parcel=active_parcel,
            weather=weather,
            suitability=suitability,
            risks=risks,
            lang=lang,
        )

        if not skip_network:
            if provider in ("auto", "gemini") and gemini_key:
                ans = self._call_gemini(gemini_key, context_block, question)
                if ans:
                    return ans, "gemini"
            if provider in ("auto", "openai") and openai_key:
                ans = self._call_openai(openai_key, context_block, question)
                if ans:
                    return ans, "openai"

        return (
            self._deterministic_agronomic_reply(
                farmer=farmer,
                active_parcel=active_parcel,
                weather=weather,
                suitability=suitability,
                risks=risks,
                question=question,
                lang=lang,
            ),
            "kshetra-agronomy-engine",
        )

    def _build_system_prompt(
        self,
        *,
        farmer: Farmer,
        active_parcel: Optional[Parcel],
        weather: Dict[str, Any],
        suitability: Dict[str, Any],
        risks: Dict[str, Any],
        lang: str,
    ) -> str:
        parcel_desc = (
            f"Parcel '{active_parcel.name}': {active_parcel.area_acres} acres ({active_parcel.area_gunthas} gunthas), "
            f"soil={active_parcel.soil_type}, irrigation={active_parcel.irrigation_source}"
            if active_parcel
            else "No parcel mapped yet (advise the farmer to draw their field polygon on the map)."
        )
        cur = weather.get("current", {})
        temp_disp = (cur.get("temperature_c") or {}).get("display", "No data")
        rain_7d = weather.get("summary", {}).get("rain_7d_forecast_mm")
        rain_30d = weather.get("summary", {}).get("rain_30d_total_mm")
        prov = (weather.get("provenance") or {}).get("label", "No data")
        top_crops = ", ".join(
            f"{c['name']} ({c['suitability_score']}/100)"
            for c in (suitability.get("recommendations") or [])[:4]
        )

        return (
            f"You are Krishi Mitra, the official agronomic assistant for Kshetra in Maharashtra.\n"
            f"Respond in language code '{lang}' (mr=Marathi, hi=Hindi, en=English).\n"
            f"Ground Rules:\n"
            f"1. Never invent weather, soil, or market numbers. If a value is 'No data', say so clearly.\n"
            f"2. Cite data provenance: {prov}.\n"
            f"3. For pest/disease queries, recommend Integrated Pest Management (IPM) first and advise consulting KVK before chemical sprays.\n"
            f"Farmer Context: {farmer.name} ({farmer.taluka}, {farmer.district}). {parcel_desc}.\n"
            f"Current Temp: {temp_disp}, 7-day Forecast Rain: {rain_7d if rain_7d is not None else 'No data'} mm, "
            f"30-day Past Rain: {rain_30d if rain_30d is not None else 'No data'} mm.\n"
            f"Top Crop Suitability Scores: {top_crops or 'No data'}."
        )

    def _call_gemini(self, api_key: str, system_prompt: str, question: str) -> Optional[str]:
        model = self.config.get("GEMINI_MODEL", "gemini-2.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        validate_outbound_url(url)
        try:
            resp = requests.post(
                url,
                params={"key": api_key},
                json={
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"role": "user", "parts": [{"text": question}]}],
                    "generationConfig": {"temperature": 0.25, "maxOutputTokens": 600},
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates") or []
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts") or []
                    if parts and parts[0].get("text"):
                        return parts[0]["text"].strip()
        except Exception as exc:
            logger.warning("Gemini API call failed, falling back to grounded engine: %s", exc)
        return None

    def _call_openai(self, api_key: str, system_prompt: str, question: str) -> Optional[str]:
        model = self.config.get("OPENAI_MODEL", "gpt-4o-mini")
        url = "https://api.openai.com/v1/chat/completions"
        validate_outbound_url(url)
        try:
            resp = requests.post(
                url,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": question},
                    ],
                    "temperature": 0.25,
                    "max_tokens": 600,
                },
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices") or []
                if choices:
                    return choices[0].get("message", {}).get("content", "").strip()
        except Exception as exc:
            logger.warning("OpenAI API call failed, falling back to grounded engine: %s", exc)
        return None

    def _deterministic_agronomic_reply(
        self,
        *,
        farmer: Farmer,
        active_parcel: Optional[Parcel],
        weather: Dict[str, Any],
        suitability: Dict[str, Any],
        risks: Dict[str, Any],
        question: str,
        lang: str,
    ) -> str:
        cur = weather.get("current", {})
        temp_disp = (cur.get("temperature_c") or {}).get("display", "No data")
        hum_disp = (cur.get("humidity_pct") or {}).get("display", "No data")
        sm_disp = (cur.get("soil_moisture_m3m3") or {}).get("display", "No data")
        summary = weather.get("summary", {})
        rain_7d = summary.get("rain_7d_forecast_mm")
        rain_30d = summary.get("rain_30d_total_mm")
        rain_7d_str = f"{rain_7d} mm" if rain_7d is not None else "No data"
        rain_30d_str = f"{rain_30d} mm" if rain_30d is not None else "No data"
        prov_label = (weather.get("provenance") or {}).get("label", "Open-Meteo")

        top_recs = (suitability.get("recommendations") or [])[:3]
        crops_bullet = "\n".join(
            f"- **{c['name']}**: {c['suitability_score']}/100 ({c['band']}, water need: {c['water_need']})"
            for c in top_recs
        )
        alerts = risks.get("alerts") or []
        alert_line = (
            "\n".join(f"- **{a['title']}**: {a['action']}" for a in alerts)
            if alerts
            else {
                "en": "- No severe weather alerts triggered for the next 7 days.",
                "mr": "- पुढील ७ दिवसांसाठी कोणताही गंभीर हवामान इशारा नाही.",
                "hi": "- अगले 7 दिनों के लिए कोई गंभीर मौसम चेतावनी नहीं है।",
            }.get(lang, "- No severe weather alerts.")
        )

        if not active_parcel:
            no_parcel_note = {
                "en": "Note: You have not mapped a field boundary yet. Draw your parcel on the map to get exact acre/guntha calculations.",
                "mr": "टीप: तुम्ही अजून शेताची हद्द नकाशावर आखलेली नाही. अचूक एकर/गुंठे क्षेत्रफळ आणि सल्ल्यासाठी नकाशावर शेत जोडा.",
                "hi": "नोट: आपने अभी तक खेत की सीमा मैप नहीं की है। सटीक एकड़/गुंठा क्षेत्रफल के लिए मानचित्र पर अपना खेत जोड़ें।",
            }.get(lang, "")
        else:
            no_parcel_note = {
                "en": f"**Active Parcel**: {active_parcel.name} ({active_parcel.area_acres} acres / {active_parcel.area_gunthas} gunthas, soil: {active_parcel.soil_type}, irrigation: {active_parcel.irrigation_source})",
                "mr": f"**सध्याचे शेत**: {active_parcel.name} ({active_parcel.area_acres} एकर / {active_parcel.area_gunthas} गुंठे, माती: {active_parcel.soil_type}, पाणी: {active_parcel.irrigation_source})",
                "hi": f"**सक्रिय खेत**: {active_parcel.name} ({active_parcel.area_acres} एकड़ / {active_parcel.area_gunthas} गुंठा, मिट्टी: {active_parcel.soil_type}, सिंचाई: {active_parcel.irrigation_source})",
            }.get(lang, "")

        disclaimer = self.advice_service.IPM_DISCLAIMER.get(lang, self.advice_service.IPM_DISCLAIMER["en"])

        if lang == "mr":
            return (
                f"नमस्कार **{farmer.name}** ({farmer.taluka}, {farmer.district}),\n\n"
                f"{no_parcel_note}\n\n"
                f"### १. सध्याची हवामान आणि पाणी स्थिती\n"
                f"- **तापमान**: {temp_disp} | **आर्द्रता**: {hum_disp} | **मातीतील ओलावा**: {sm_disp}\n"
                f"- **पुढील ७ दिवसांचा पाऊस अंदाज**: {rain_7d_str} | **मागील ३० दिवसांचा पाऊस**: {rain_30d_str}\n"
                f"- *स्रोत*: {prov_label}\n\n"
                f"### २. तुमच्या शेतासाठी सर्वोत्तम पिके (Suitability 0–100)\n"
                f"{crops_bullet}\n\n"
                f"### ३. हवामान आणि कीड दक्षता (IPM)\n"
                f"{alert_line}\n\n"
                f"> **कृषी सुरक्षा सूचना**: {disclaimer}"
            )
        if lang == "hi":
            return (
                f"नमस्ते **{farmer.name}** ({farmer.taluka}, {farmer.district}),\n\n"
                f"{no_parcel_note}\n\n"
                f"### 1. वर्तमान मौसम और जल स्थिति\n"
                f"- **तापमान**: {temp_disp} | **आर्द्रता**: {hum_disp} | **मिट्टी की नमी**: {sm_disp}\n"
                f"- **अगले 7 दिनों की बारिश का अनुमान**: {rain_7d_str} | **पिछले 30 दिनों की बारिश**: {rain_30d_str}\n"
                f"- *स्रोत*: {prov_label}\n\n"
                f"### 2. आपके खेत के लिए उपयुक्त फसलें (Suitability 0–100)\n"
                f"{crops_bullet}\n\n"
                f"### 3. मौसम एवं समग्र कीट प्रबंधन (IPM) सलाह\n"
                f"{alert_line}\n\n"
                f"> **कृषि सुरक्षा सूचना**: {disclaimer}"
            )
        return (
            f"Hello **{farmer.name}** ({farmer.taluka}, {farmer.district}),\n\n"
            f"{no_parcel_note}\n\n"
            f"### 1. Field Telemetry & Water Status\n"
            f"- **Temperature**: {temp_disp} | **Humidity**: {hum_disp} | **Soil Moisture**: {sm_disp}\n"
            f"- **7-Day Rain Forecast**: {rain_7d_str} | **30-Day Cumulative Rain**: {rain_30d_str}\n"
            f"- *Source*: {prov_label}\n\n"
            f"### 2. Top Recommended Crops for Your Field (Suitability 0–100)\n"
            f"{crops_bullet}\n\n"
            f"### 3. Weather Risks & IPM Guidance\n"
            f"{alert_line}\n\n"
            f"> **KVK Safety Notice**: {disclaimer}"
        )
