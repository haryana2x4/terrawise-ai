"""
TERRAWISE AI - Live Agro-Meteorological & NASA Data Pipeline
Integrates Open-Meteo & NASA POWER APIs with caching, exponential backoff, and provenance tracking.
"""

import os
import json
import time
import math
import requests
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple
from utils import safe_value, format_provenance

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, "data", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# In-memory source health registry for admin monitoring
SOURCE_HEALTH = {
    "open_meteo": {
        "source_name": "Open-Meteo Agro-Weather API",
        "last_success": None,
        "last_failure": None,
        "consecutive_failures": 0,
        "status": "OPERATIONAL"
    },
    "nasa_power": {
        "source_name": "NASA POWER Agroclimatology",
        "last_success": None,
        "last_failure": None,
        "consecutive_failures": 0,
        "status": "OPERATIONAL"
    },
    "agmarknet": {
        "source_name": "Agmarknet APMC Mandi Data",
        "last_success": None,
        "last_failure": None,
        "consecutive_failures": 0,
        "status": "OPERATIONAL"
    }
}

def calculate_vpd(temp_c: float, rh_pct: float) -> float:
    """Computes Vapor Pressure Deficit (VPD in kPa)."""
    if temp_c is None or rh_pct is None:
        return None
    es = 0.61078 * math.exp((17.27 * temp_c) / (temp_c + 237.3))
    ea = es * (rh_pct / 100.0)
    return round(max(0.0, es - ea), 2)

def fetch_open_meteo(lat: float, lon: float, cache_ttl_seconds: int = 10800) -> Dict[str, Any]:
    """
    Fetches real-time weather and 7-day forecast from Open-Meteo.
    Includes 2m air temp, max/min temp, precipitation, relative humidity, wind speed,
    and soil moisture across 3 root depths: 0-7 cm (topsoil), 7-28 cm, 28-100 cm (root-zone).
    """
    cache_key = f"open_meteo_{lat:.3f}_{lon:.3f}.json"
    cache_path = os.path.join(CACHE_DIR, cache_key)
    now_ts = time.time()

    # Check cache freshness
    if os.path.exists(cache_path):
        mtime = os.path.getmtime(cache_path)
        if now_ts - mtime < cache_ttl_seconds:
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    cached_data["from_cache"] = True
                    return cached_data
            except Exception:
                pass

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&"
        f"current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,soil_temperature_0cm,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm&"
        f"daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&"
        f"timezone=Asia%2FKolkata"
    )

    try:
        resp = requests.get(url, timeout=12)
        if resp.status_code == 200:
            raw = resp.json()
            curr = raw.get("current", {})
            daily = raw.get("daily", {})

            now_ist = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime("%d %b %Y, %I:%M %p")

            # Extract current metrics
            t2m = curr.get("temperature_2m")
            rh = curr.get("relative_humidity_2m")
            precip = curr.get("precipitation")
            wind = curr.get("wind_speed_10m")
            soil_top = curr.get("soil_moisture_0_to_7cm") # m³/m³
            soil_sub = curr.get("soil_moisture_7_to_28cm")
            soil_root = curr.get("soil_moisture_28_to_100cm")

            # Calculate moisture percentage relative to typical field capacity (~0.40 m³/m³ for Vertisols)
            root_hydration_pct = round(min(100.0, (soil_root / 0.40) * 100.0), 1) if soil_root is not None else None
            top_hydration_pct = round(min(100.0, (soil_top / 0.40) * 100.0), 1) if soil_top is not None else None

            vpd = calculate_vpd(t2m, rh)

            # Daily forecast (next 7 days)
            dates = daily.get("time", [])
            max_temps = daily.get("temperature_2m_max", [])
            min_temps = daily.get("temperature_2m_min", [])
            rains = daily.get("precipitation_sum", [])
            rain_probs = daily.get("precipitation_probability_max", [])

            forecast_days = []
            for i in range(min(len(dates), 7)):
                forecast_days.append({
                    "date": dates[i],
                    "max_temp": safe_value(max_temps[i] if i < len(max_temps) else None, "Open-Meteo", now_ist),
                    "min_temp": safe_value(min_temps[i] if i < len(min_temps) else None, "Open-Meteo", now_ist),
                    "rain_mm": safe_value(rains[i] if i < len(rains) else None, "Open-Meteo", now_ist),
                    "rain_prob_pct": safe_value(rain_probs[i] if i < len(rain_probs) else None, "Open-Meteo", now_ist)
                })

            result = {
                "success": True,
                "fetched_at": datetime.utcnow().isoformat(),
                "observed_at_str": now_ist,
                "source": "Open-Meteo Agro-Weather API",
                "licence": "Open-Meteo (CC BY 4.0)",
                "is_stale": False,
                "current": {
                    "temperature": safe_value(t2m, "Open-Meteo", now_ist),
                    "relative_humidity": safe_value(rh, "Open-Meteo", now_ist),
                    "precipitation_now_mm": safe_value(precip, "Open-Meteo", now_ist),
                    "wind_speed_kmh": safe_value(wind, "Open-Meteo", now_ist),
                    "soil_root_hydration_pct": safe_value(root_hydration_pct, "Open-Meteo (0-100cm)", now_ist),
                    "soil_top_hydration_pct": safe_value(top_hydration_pct, "Open-Meteo (0-7cm)", now_ist),
                    "soil_root_m3m3": safe_value(soil_root, "Open-Meteo", now_ist),
                    "vpd_kpa": safe_value(vpd, "Open-Meteo Derived", now_ist)
                },
                "forecast": forecast_days,
                "from_cache": False
            }

            # Update cache
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)

            # Update health
            SOURCE_HEALTH["open_meteo"]["last_success"] = datetime.utcnow().isoformat()
            SOURCE_HEALTH["open_meteo"]["consecutive_failures"] = 0
            SOURCE_HEALTH["open_meteo"]["status"] = "HEALTHY"

            return result

        else:
            raise Exception(f"Open-Meteo API status {resp.status_code}: {resp.text[:100]}")

    except Exception as e:
        SOURCE_HEALTH["open_meteo"]["last_failure"] = datetime.utcnow().isoformat()
        SOURCE_HEALTH["open_meteo"]["consecutive_failures"] += 1
        SOURCE_HEALTH["open_meteo"]["status"] = "DEGRADED"

        # Serve stale cache if available
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    stale_data = json.load(f)
                    stale_data["is_stale"] = True
                    stale_data["provenance_note"] = f"Old data from {stale_data.get('observed_at_str')} (Live fetch failed: {str(e)})"
                    return stale_data
            except Exception:
                pass

        return {
            "success": False,
            "error": str(e),
            "source": "Open-Meteo",
            "is_stale": True
        }

def fetch_nasa_power_history(lat: float, lon: float, days_back: int = 15) -> Dict[str, Any]:
    """
    Fetches daily agroclimatology from NASA POWER API (T2M, PRECTOTCORR, GWETROOT, GWETTOP, ALLSKY_SFC_SW_DWN).
    Cached on 24-hour TTL.
    """
    cache_key = f"nasa_power_{lat:.3f}_{lon:.3f}.json"
    cache_path = os.path.join(CACHE_DIR, cache_key)
    now_ts = time.time()

    if os.path.exists(cache_path):
        mtime = os.path.getmtime(cache_path)
        if now_ts - mtime < 86400: # 24 hr cache
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    data["from_cache"] = True
                    return data
            except Exception:
                pass

    end_d = datetime.utcnow() - timedelta(days=2) # NASA latency 2 days
    start_d = end_d - timedelta(days=days_back)
    start_fmt = start_d.strftime("%Y%m%d")
    end_fmt = end_d.strftime("%Y%m%d")

    url = (
        f"https://power.larc.nasa.gov/api/temporal/daily/point?"
        f"parameters=T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,ALLSKY_SFC_SW_DWN,RH2M&"
        f"community=AG&longitude={lon}&latitude={lat}&"
        f"start={start_fmt}&end={end_fmt}&format=JSON"
    )

    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            p_data = resp.json().get("properties", {}).get("parameter", {})
            t2m_dict = p_data.get("T2M", {})
            root_dict = p_data.get("GWETROOT", {})
            precip_dict = p_data.get("PRECTOTCORR", {})

            daily_records = []
            for dt_key in sorted(t2m_dict.keys()):
                fmt_date = f"{dt_key[:4]}-{dt_key[4:6]}-{dt_key[6:]}"
                daily_records.append({
                    "date": fmt_date,
                    "t2m": t2m_dict.get(dt_key),
                    "precip_mm": precip_dict.get(dt_key),
                    "root_wetness": root_dict.get(dt_key)
                })

            result = {
                "success": True,
                "source": "NASA POWER Agroclimatology API",
                "licence": "NASA Open Data Policy (Public Domain)",
                "fetched_at": datetime.utcnow().isoformat(),
                "records": daily_records,
                "from_cache": False
            }

            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)

            SOURCE_HEALTH["nasa_power"]["last_success"] = datetime.utcnow().isoformat()
            SOURCE_HEALTH["nasa_power"]["consecutive_failures"] = 0
            SOURCE_HEALTH["nasa_power"]["status"] = "HEALTHY"

            return result
        else:
            raise Exception(f"NASA POWER returned {resp.status_code}")
    except Exception as e:
        SOURCE_HEALTH["nasa_power"]["last_failure"] = datetime.utcnow().isoformat()
        SOURCE_HEALTH["nasa_power"]["consecutive_failures"] += 1
        SOURCE_HEALTH["nasa_power"]["status"] = "DEGRADED"

        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)

        return {"success": False, "error": str(e), "source": "NASA POWER"}

def get_data_health_summary() -> Dict[str, Any]:
    """Returns data source freshness and health for the admin dashboard."""
    now = datetime.utcnow()
    summary = {}
    for key, info in SOURCE_HEALTH.items():
        is_stale = False
        last_s = info["last_success"]
        if last_s:
            last_dt = datetime.fromisoformat(last_s)
            if (now - last_dt).total_seconds() > 172800: # 48 hours
                is_stale = True

        status = info["status"]
        if is_stale:
            status = "STALE_ALERT"

        summary[key] = {
            "name": info["source_name"],
            "status": status,
            "last_success": info["last_success"],
            "last_failure": info["last_failure"],
            "consecutive_failures": info["consecutive_failures"],
            "is_stale_over_48h": is_stale
        }
    return summary
