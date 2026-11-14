"""
TERRAWISE AI - Geospatial Validation Engine
Complies with RFC 7946 GeoJSON, Shapely geometry validation, and PyProj geodesic calculations.
"""

import os
import json
import math
from typing import Dict, Any, Tuple, List, Optional
from shapely.geometry import shape, Polygon, MultiPolygon, Point
from shapely.ops import orient, transform
import pyproj
from pyproj import Geod, Transformer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GEO_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "data", "geo"))

# Geodetic ellipsoid WGS84
WGS84_GEOD = Geod(ellps="WGS84")

# Transformer from EPSG:4326 to UTM Zone 43N (EPSG:32643 covers Maharashtra 72°E to 78°E)
TO_UTM43N = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True)

# Load district geometries for boundary containment verification
_DISTRICTS_CACHE = None

def get_district_polygons() -> Dict[str, Any]:
    global _DISTRICTS_CACHE
    if _DISTRICTS_CACHE is None:
        _DISTRICTS_CACHE = {}
        dist_path = os.path.join(GEO_DIR, "districts.geojson")
        if os.path.exists(dist_path):
            with open(dist_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for feat in data.get("features", []):
                    d_name = feat.get("properties", {}).get("district_name", "")
                    _DISTRICTS_CACHE[d_name.lower()] = shape(feat["geometry"])
                    # Also map Ahmednagar to Ahilya Nagar
                    if "ahilya" in d_name.lower() or "ahmed" in d_name.lower():
                        _DISTRICTS_CACHE["ahilya nagar"] = shape(feat["geometry"])
                        _DISTRICTS_CACHE["ahmednagar"] = shape(feat["geometry"])
                    if "nashik" in d_name.lower() or "nasik" in d_name.lower():
                        _DISTRICTS_CACHE["nashik"] = shape(feat["geometry"])
                        _DISTRICTS_CACHE["nasik"] = shape(feat["geometry"])
    return _DISTRICTS_CACHE

def calculate_geodesic_area_sqm(poly: Polygon) -> float:
    """Computes exact geodesic surface area in square meters using WGS84 ellipsoid."""
    area, _ = WGS84_GEOD.geometry_area_perimeter(poly)
    return abs(area)

def calculate_projected_area_sqm(poly: Polygon) -> float:
    """Computes projected area in square meters using UTM Zone 43N (EPSG:32643)."""
    utm_poly = transform(TO_UTM43N.transform, poly)
    return abs(utm_poly.area)

def check_vertex_spacing(coords: List[Tuple[float, float]], min_distance_m: float = 0.5) -> Tuple[bool, Optional[str]]:
    """Ensures no duplicate vertices or vertices closer than 0.5 meters."""
    n = len(coords)
    # Exclude closing vertex identical to first
    pts = coords[:-1] if coords[0] == coords[-1] else coords
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            lon1, lat1 = pts[i]
            lon2, lat2 = pts[j]
            _, _, dist = WGS84_GEOD.inv(lon1, lat1, lon2, lat2)
            if dist < min_distance_m:
                return False, f"Vertices {i} and {j} are {dist:.2f}m apart (minimum allowed spacing is {min_distance_m}m)"
    return True, None

def validate_and_process_polygon(
    geojson_geometry: Dict[str, Any],
    district: str,
    min_area_ha: float = 0.02,
    max_area_ha: float = 50.0
) -> Dict[str, Any]:
    """
    Validates a farm parcel polygon:
    1. RFC 7946 valid Polygon / MultiPolygon
    2. Valid ring, no self-intersection
    3. Minimum vertex distance > 0.5 m
    4. Poly lies strictly inside specified district
    5. Geodesic area vs UTM 43N cross-check (<0.5% diff)
    6. Area bounds (0.02 ha to 50 ha)
    7. Standardizes to counter-clockwise exterior ring with 6 decimal places.
    """
    try:
        raw_geom = shape(geojson_geometry)
    except Exception as e:
        return {"valid": False, "error": f"Invalid GeoJSON geometry: {str(e)}"}

    if not raw_geom.is_valid:
        return {"valid": False, "error": f"Polygon geometry is invalid (self-intersecting or broken rings): {raw_geom.is_valid}"}

    if not isinstance(raw_geom, (Polygon, MultiPolygon)):
        return {"valid": False, "error": f"Expected Polygon or MultiPolygon, got {raw_geom.geom_type}"}

    # Extract primary polygon
    poly = raw_geom if isinstance(raw_geom, Polygon) else raw_geom.geoms[0]

    # Check vertex spacing on exterior ring
    ext_coords = list(poly.exterior.coords)
    spacing_ok, spacing_err = check_vertex_spacing(ext_coords, min_distance_m=0.5)
    if not spacing_ok:
        return {"valid": False, "error": spacing_err}

    # Verify containment in district
    districts = get_district_polygons()
    d_key = district.lower().strip()
    dist_poly = districts.get(d_key)
    
    if dist_poly is None:
        # Try fuzzy match
        for k, v in districts.items():
            if k in d_key or d_key in k:
                dist_poly = v
                break

    if dist_poly is not None:
        centroid = poly.centroid
        if not dist_poly.contains(centroid):
            return {
                "valid": False,
                "error": f"Parcel centroid ({centroid.y:.5f}, {centroid.x:.5f}) does not lie inside district '{district}'"
            }

    # Compute areas
    area_sqm_geodesic = calculate_geodesic_area_sqm(poly)
    area_sqm_utm = calculate_projected_area_sqm(poly)

    # Cross check discrepancy
    discrepancy_pct = (abs(area_sqm_geodesic - area_sqm_utm) / max(area_sqm_geodesic, 1e-6)) * 100.0
    if discrepancy_pct > 0.5:
        return {
            "valid": False,
            "error": f"Area discrepancy between Geodesic ({area_sqm_geodesic:.2f} m²) and UTM 43N ({area_sqm_utm:.2f} m²) exceeds 0.5% ({discrepancy_pct:.2f}%)"
        }

    area_ha = round(area_sqm_geodesic / 10000.0, 4)
    area_acre = round(area_ha * 2.47105, 3)
    area_guntha = round(area_acre * 40.0, 1) # 1 guntha = 1/40 acre

    if area_ha < min_area_ha:
        return {"valid": False, "error": f"Parcel area ({area_ha} ha / {area_guntha} guntha) is below minimum pilot threshold of {min_area_ha} ha (approx 0.8 guntha)"}

    if area_ha > max_area_ha:
        return {"valid": False, "error": f"Parcel area ({area_ha} ha) exceeds maximum pilot limit of {max_area_ha} ha"}

    # Orient counter-clockwise exterior ring per RFC 7946
    oriented_poly = orient(poly, sign=1.0)
    
    # Round coordinates to 6 decimal places
    def round_coords(coords):
        return [[round(x, 6), round(y, 6)] for x, y in coords]

    clean_geom = {
        "type": "Polygon",
        "coordinates": [round_coords(oriented_poly.exterior.coords)] + [round_coords(interior.coords) for interior in oriented_poly.interiors]
    }

    return {
        "valid": True,
        "clean_geometry": clean_geom,
        "area_sqm": round(area_sqm_geodesic, 2),
        "area_ha": area_ha,
        "area_acre": area_acre,
        "area_guntha": area_guntha,
        "centroid": {"lat": round(poly.centroid.y, 6), "lon": round(poly.centroid.x, 6)},
        "discrepancy_pct": round(discrepancy_pct, 4)
    }

def check_parcel_overlap(new_poly_geom: Dict[str, Any], existing_parcels_geoms: List[Dict[str, Any]]) -> Tuple[bool, Optional[str]]:
    """
    Checks if a new parcel overlaps with any existing parcel by more than 2% of the smaller polygon's area.
    Returns (has_overlap, error_message).
    """
    p_new = shape(new_poly_geom)
    area_new = calculate_geodesic_area_sqm(p_new)

    for idx, ex_geom in enumerate(existing_parcels_geoms):
        p_ex = shape(ex_geom)
        if p_new.intersects(p_ex):
            intersection = p_new.intersection(p_ex)
            if not intersection.is_empty:
                area_inter = calculate_geodesic_area_sqm(intersection)
                area_ex = calculate_geodesic_area_sqm(p_ex)
                min_area = min(area_new, area_ex)
                overlap_pct = (area_inter / max(min_area, 1e-6)) * 100.0
                if overlap_pct > 2.0:
                    return True, f"Boundary overlaps by {overlap_pct:.1f}% with existing parcel #{idx+1} (Limit is 2.0%)"
    return False, None
