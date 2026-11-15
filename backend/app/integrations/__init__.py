"""Hardened external data integrations with SSRF allowlist, circuit breaker, retry, and provenance."""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests
from sqlalchemy.orm import Session

from app.core import AppError, format_provenance, safe_value
from app.extensions import TTLCache
from app.models import WeatherSnapshot
from app.repositories import TelemetryRepository

logger = logging.getLogger(__name__)

ALLOWED_OUTBOUND_HOSTS = frozenset(
    {
        "api.open-meteo.com",
        "power.larc.nasa.gov",
        "rest.isric.org",
        "api.data.gov.in",
        "generativelanguage.googleapis.com",
        "api.openai.com",
        "gibs.earthdata.nasa.gov",
        "localhost",
        "127.0.0.1",
    }
)


class CircuitBreaker:
    """Per-source circuit breaker preventing cascading timeouts when an upstream API is down."""

    def __init__(self, failure_threshold: int = 3, recovery_timeout_sec: int = 120) -> None:
        self.failure_threshold = failure_threshold
        self.recovery_timeout_sec = recovery_timeout_sec
        self._failures: Dict[str, int] = {}
        self._opened_at: Dict[str, float] = {}

    def allow_request(self, source: str) -> bool:
        opened = self._opened_at.get(source)
        if opened is None:
            return True
        if (time.time() - opened) >= self.recovery_timeout_sec:
            return True
        return False

    def record_success(self, source: str) -> None:
        self._failures[source] = 0
        self._opened_at.pop(source, None)

    def record_failure(self, source: str) -> None:
        count = self._failures.get(source, 0) + 1
        self._failures[source] = count
        if count >= self.failure_threshold:
            self._opened_at[source] = time.time()


circuit_breaker = CircuitBreaker()
integration_cache = TTLCache(default_ttl_seconds=1800)


def validate_outbound_url(url: str) -> None:
    """Block any outbound request to a host not on the strict allowlist (SSRF protection)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("https", "http"):
        raise AppError("SSRF_BLOCKED", f"Disallowed URL scheme: {parsed.scheme}", 400)
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_OUTBOUND_HOSTS:
        raise AppError("SSRF_BLOCKED", f"Outbound host '{host}' is not on the security allowlist.", 403)


def safe_http_get(
    url: str,
    *,
    source_name: str,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    timeout: int = 8,
    retries: int = 2,
    db_session: Optional[Session] = None,
) -> Tuple[Optional[Dict[str, Any]], float, Optional[str]]:
    """Execute an SSRF-validated GET request with retry, circuit breaker, and health tracking."""
    validate_outbound_url(url)
    if not circuit_breaker.allow_request(source_name):
        return None, 0.0, f"Circuit breaker open for {source_name}"

    last_err: Optional[str] = None
    start_ts = time.perf_counter()
    for attempt in range(retries + 1):
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=timeout)
            latency_ms = (time.perf_counter() - start_ts) * 1000.0
            if resp.status_code == 200:
                circuit_breaker.record_success(source_name)
                if db_session is not None:
                    try:
                        TelemetryRepository.record_source_health(
                            db_session, source_name, success=True, latency_ms=latency_ms
                        )
                    except Exception:
                        db_session.rollback()
                return resp.json(), latency_ms, None
            last_err = f"HTTP {resp.status_code}"
        except Exception as exc:
            last_err = str(exc)
        if attempt < retries:
            time.sleep(0.25 * (attempt + 1))

    latency_ms = (time.perf_counter() - start_ts) * 1000.0
    circuit_breaker.record_failure(source_name)
    if db_session is not None:
        try:
            TelemetryRepository.record_source_health(
                db_session, source_name, success=False, latency_ms=latency_ms, error_msg=last_err
            )
        except Exception:
            db_session.rollback()
    return None, latency_ms, last_err


class OpenMeteoClient:
    """Fetches real 7-day forecast, soil moisture, and 30-day history from Open-Meteo with DB fallback."""

    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    @classmethod
    def fetch_weather(
        cls,
        lat: float,
        lon: float,
        db_session: Optional[Session] = None,
        skip_network: bool = False,
    ) -> Dict[str, Any]:
        lat_grid = f"{float(lat):.2f}"
        lon_grid = f"{float(lon):.2f}"
        cache_key = f"openmeteo:{lat_grid}:{lon_grid}"

        mem_cached = integration_cache.get(cache_key)
        if mem_cached is not None:
            return mem_cached

        now_utc = datetime.now(timezone.utc)
        now_naive = now_utc.replace(tzinfo=None)

        # Check fresh DB snapshot (< 1 hour old)
        snapshot: Optional[WeatherSnapshot] = None
        if db_session is not None:
            snapshot = (
                db_session.query(WeatherSnapshot)
                .filter(WeatherSnapshot.lat_grid == lat_grid, WeatherSnapshot.lon_grid == lon_grid)
                .first()
            )
            if snapshot and (now_naive - snapshot.fetched_at).total_seconds() < 3600:
                payload = json.loads(snapshot.payload_json)
                payload["provenance"] = format_provenance(
                    snapshot.source_name, snapshot.fetched_at, stale=False
                )
                integration_cache.set(cache_key, payload, ttl_seconds=900)
                return payload

        if not skip_network:
            params = {
                "latitude": lat_grid,
                "longitude": lon_grid,
                "current": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,soil_moisture_0_to_7cm",
                "hourly": "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,wind_speed_10m_max,shortwave_radiation_sum",
                "past_days": 30,
                "forecast_days": 7,
                "timezone": "Asia/Kolkata",
            }
            raw, _, err = safe_http_get(
                cls.BASE_URL,
                source_name="Open-Meteo",
                params=params,
                timeout=8,
                retries=1,
                db_session=db_session,
            )
            if raw and "current" in raw and "daily" in raw:
                structured = cls._transform_openmeteo(raw, lat_grid, lon_grid, now_utc.isoformat())
                if db_session is not None:
                    try:
                        if snapshot:
                            snapshot.payload_json = json.dumps(structured)
                            snapshot.fetched_at = now_naive
                        else:
                            db_session.add(
                                WeatherSnapshot(
                                    lat_grid=lat_grid,
                                    lon_grid=lon_grid,
                                    source_name="Open-Meteo",
                                    payload_json=json.dumps(structured),
                                    fetched_at=now_naive,
                                )
                            )
                        db_session.commit()
                    except Exception:
                        db_session.rollback()
                integration_cache.set(cache_key, structured, ttl_seconds=1800)
                return structured

        # Honest fallback: if an older DB snapshot exists, return it clearly marked as stale
        if snapshot is not None:
            payload = json.loads(snapshot.payload_json)
            payload["stale"] = True
            payload["provenance"] = format_provenance(
                snapshot.source_name, snapshot.fetched_at, stale=True
            )
            return payload

        # Missing is NOT zero (Ground Rule G1 & G2): return explicit null values and "No data"
        return {
            "status": "unavailable",
            "stale": False,
            "coordinates": {"lat": float(lat_grid), "lon": float(lon_grid)},
            "current": {
                "temperature_c": safe_value(None, "°C"),
                "humidity_pct": safe_value(None, "%"),
                "precipitation_mm": safe_value(None, "mm"),
                "wind_kmh": safe_value(None, "km/h"),
                "soil_moisture_m3m3": safe_value(None, "m³/m³"),
            },
            "forecast_7d": [],
            "history_30d": [],
            "hourly_48h": [],
            "summary": {
                "rain_7d_forecast_mm": None,
                "rain_30d_total_mm": None,
                "et0_7d_total_mm": None,
                "max_temp_next_7d_c": None,
            },
            "provenance": {
                "source": "Open-Meteo",
                "fetched_at": None,
                "stale": False,
                "label": "No data available (upstream unreachable and no cached telemetry for this coordinate).",
            },
        }

    @classmethod
    def _transform_openmeteo(
        cls, raw: Dict[str, Any], lat_grid: str, lon_grid: str, fetched_iso: str
    ) -> Dict[str, Any]:
        cur = raw.get("current", {})
        daily = raw.get("daily", {})
        times = daily.get("time", [])
        tmax = daily.get("temperature_2m_max", [])
        tmin = daily.get("temperature_2m_min", [])
        rain = daily.get("precipitation_sum", [])
        prob = daily.get("precipitation_probability_max", [])
        et0 = daily.get("et0_fao_evapotranspiration", [])
        wind = daily.get("wind_speed_10m_max", [])
        solar = daily.get("shortwave_radiation_sum", [])

        history_30d: List[Dict[str, Any]] = []
        forecast_7d: List[Dict[str, Any]] = []
        split_idx = max(0, len(times) - 7)

        for idx, dt_str in enumerate(times):
            rain_v = rain[idx] if idx < len(rain) else None
            et0_v = et0[idx] if idx < len(et0) else None
            water_bal = (
                round(float(rain_v) - float(et0_v), 1)
                if rain_v is not None and et0_v is not None
                else None
            )
            day_entry = {
                "date": dt_str,
                "temp_max_c": tmax[idx] if idx < len(tmax) else None,
                "temp_min_c": tmin[idx] if idx < len(tmin) else None,
                "rain_mm": rain_v,
                "rain_prob_pct": prob[idx] if idx < len(prob) else None,
                "et0_mm": et0_v,
                "water_balance_mm": water_bal,
                "wind_max_kmh": wind[idx] if idx < len(wind) else None,
                "solar_mj_m2": solar[idx] if idx < len(solar) else None,
            }
            if idx < split_idx:
                history_30d.append(day_entry)
            else:
                forecast_7d.append(day_entry)

        # Extract next 48 hourly slots starting from today's forecast window
        hourly = raw.get("hourly") or {}
        h_times = hourly.get("time") or []
        h_temp = hourly.get("temperature_2m") or []
        h_rh = hourly.get("relative_humidity_2m") or []
        h_rain = hourly.get("precipitation") or []
        h_wind = hourly.get("wind_speed_10m") or []
        hourly_48h: List[Dict[str, Any]] = []
        cur_time = str(cur.get("time") or "")
        start_h_idx = 0
        if cur_time and h_times:
            prefix = cur_time[:13]
            for i, ht in enumerate(h_times):
                if str(ht) >= prefix:
                    start_h_idx = i
                    break
        for i in range(start_h_idx, min(len(h_times), start_h_idx + 48)):
            hourly_48h.append(
                {
                    "time": h_times[i],
                    "temp_c": h_temp[i] if i < len(h_temp) else None,
                    "rh_pct": h_rh[i] if i < len(h_rh) else None,
                    "rain_mm": h_rain[i] if i < len(h_rain) else None,
                    "wind_kmh": h_wind[i] if i < len(h_wind) else None,
                }
            )

        valid_rain_7d = [d["rain_mm"] for d in forecast_7d if d["rain_mm"] is not None]
        valid_rain_30d = [d["rain_mm"] for d in history_30d if d["rain_mm"] is not None]
        valid_et0_7d = [d["et0_mm"] for d in forecast_7d if d["et0_mm"] is not None]
        valid_tmax_7d = [d["temp_max_c"] for d in forecast_7d if d["temp_max_c"] is not None]

        return {
            "status": "ok",
            "stale": False,
            "coordinates": {"lat": float(lat_grid), "lon": float(lon_grid)},
            "current": {
                "temperature_c": safe_value(cur.get("temperature_2m"), "°C"),
                "humidity_pct": safe_value(cur.get("relative_humidity_2m"), "%"),
                "precipitation_mm": safe_value(cur.get("precipitation"), "mm"),
                "wind_kmh": safe_value(cur.get("wind_speed_10m"), "km/h"),
                "soil_moisture_m3m3": safe_value(cur.get("soil_moisture_0_to_7cm"), "m³/m³"),
            },
            "forecast_7d": forecast_7d,
            "history_30d": history_30d,
            "hourly_48h": hourly_48h,
            "summary": {
                "rain_7d_forecast_mm": round(sum(valid_rain_7d), 1) if valid_rain_7d else None,
                "rain_30d_total_mm": round(sum(valid_rain_30d), 1) if valid_rain_30d else None,
                "et0_7d_total_mm": round(sum(valid_et0_7d), 1) if valid_et0_7d else None,
                "max_temp_next_7d_c": round(max(valid_tmax_7d), 1) if valid_tmax_7d else None,
            },
            "provenance": format_provenance("Open-Meteo IFS/GFS", fetched_iso, stale=False),
        }


class SoilGridsClient:
    """Queries ISRIC SoilGrids v2.0 for 250m soil properties; returns honest 'No data' if unavailable."""

    BASE_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"

    @classmethod
    def fetch_soil_profile(
        cls,
        lat: float,
        lon: float,
        declared_soil_type: Optional[str] = None,
        db_session: Optional[Session] = None,
        skip_network: bool = False,
    ) -> Dict[str, Any]:
        cache_key = f"soilgrids:{lat:.2f}:{lon:.2f}"
        cached = integration_cache.get(cache_key)
        if cached is not None:
            return cached

        now_iso = datetime.now(timezone.utc).isoformat()
        if not skip_network:
            params = {
                "lat": round(float(lat), 4),
                "lon": round(float(lon), 4),
                "property": ["clay", "sand", "soc", "phh2o", "nitrogen"],
                "depth": "0-5cm",
                "value": "mean",
            }
            raw, _, _ = safe_http_get(
                cls.BASE_URL,
                source_name="ISRIC SoilGrids",
                params=params,
                timeout=6,
                retries=1,
                db_session=db_session,
            )
            if raw and "properties" in raw and "layers" in raw["properties"]:
                props: Dict[str, Optional[float]] = {}
                for layer in raw["properties"]["layers"]:
                    name = layer.get("name")
                    depths = layer.get("depths", [])
                    if depths and "values" in depths[0]:
                        val = depths[0]["values"].get("mean")
                        if val is not None:
                            props[name] = val / 10.0
                result = {
                    "status": "ok",
                    "declared_soil_type": declared_soil_type or "No data",
                    "ph": safe_value(props.get("phh2o"), "pH"),
                    "clay_pct": safe_value(props.get("clay"), "%"),
                    "sand_pct": safe_value(props.get("sand"), "%"),
                    "organic_carbon_g_kg": safe_value(props.get("soc"), "g/kg"),
                    "nitrogen_g_kg": safe_value(props.get("nitrogen"), "g/kg"),
                    "provenance": format_provenance("ISRIC SoilGrids 250m v2.0", now_iso, stale=False),
                }
                integration_cache.set(cache_key, result, ttl_seconds=86400)
                return result

        return {
            "status": "farmer_declared_only" if declared_soil_type else "unavailable",
            "declared_soil_type": declared_soil_type or "No data",
            "ph": safe_value(None, "pH"),
            "clay_pct": safe_value(None, "%"),
            "sand_pct": safe_value(None, "%"),
            "organic_carbon_g_kg": safe_value(None, "g/kg"),
            "nitrogen_g_kg": safe_value(None, "g/kg"),
            "provenance": {
                "source": "Farmer Parcel Declaration (ISRIC SoilGrids live query unavailable)",
                "fetched_at": now_iso,
                "stale": False,
                "label": "Farmer-declared soil classification; laboratory or satellite soil chemistry has no data yet.",
            },
        }


class AgmarknetClient:
    """Queries Agmarknet (data.gov.in) mandi prices when AGMARKNET_API_KEY is set; never invents prices."""

    BASE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

    @classmethod
    def fetch_market_prices(
        cls,
        *,
        api_key: str,
        district: str = "Ahilya Nagar",
        commodity: Optional[str] = None,
        db_session: Optional[Session] = None,
    ) -> Dict[str, Any]:
        now_iso = datetime.now(timezone.utc).isoformat()
        if not api_key:
            return {
                "status": "unconfigured",
                "district": district,
                "records": [],
                "message": "No data — live Agmarknet mandi feed requires AGMARKNET_API_KEY in environment configuration.",
                "provenance": {
                    "source": "Agmarknet (data.gov.in)",
                    "fetched_at": None,
                    "stale": False,
                    "label": "No data (AGMARKNET_API_KEY not configured)",
                },
            }

        cache_key = f"agmarknet:{district}:{commodity or 'all'}"
        cached = integration_cache.get(cache_key)
        if cached is not None:
            return cached

        params: Dict[str, Any] = {
            "api-key": api_key,
            "format": "json",
            "limit": 25,
            "filters[state]": "Maharashtra",
        }
        if commodity:
            params["filters[commodity]"] = commodity

        raw, _, err = safe_http_get(
            cls.BASE_URL,
            source_name="Agmarknet",
            params=params,
            timeout=8,
            retries=1,
            db_session=db_session,
        )
        if raw and "records" in raw:
            records = []
            for rec in raw.get("records", []):
                records.append(
                    {
                        "market": rec.get("market") or "No data",
                        "district": rec.get("district") or district,
                        "commodity": rec.get("commodity") or "No data",
                        "variety": rec.get("variety") or "Standard",
                        "arrival_date": rec.get("arrival_date") or now_iso[:10],
                        "min_price_inr_qtl": safe_value(rec.get("min_price"), "₹/qtl", 0),
                        "max_price_inr_qtl": safe_value(rec.get("max_price"), "₹/qtl", 0),
                        "modal_price_inr_qtl": safe_value(rec.get("modal_price"), "₹/qtl", 0),
                    }
                )
            payload = {
                "status": "ok",
                "district": district,
                "records": records,
                "provenance": format_provenance("Agmarknet (data.gov.in)", now_iso, stale=False),
            }
            integration_cache.set(cache_key, payload, ttl_seconds=3600)
            return payload

        return {
            "status": "unavailable",
            "district": district,
            "records": [],
            "message": f"No data — Agmarknet upstream unavailable ({err or 'timeout'}).",
            "provenance": {
                "source": "Agmarknet (data.gov.in)",
                "fetched_at": None,
                "stale": False,
                "label": "No data (upstream unavailable)",
            },
        }
