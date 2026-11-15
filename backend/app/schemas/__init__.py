"""Request payload validators and schema normalizers."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

from app.core import AppError

ALLOWED_LANGUAGES = {"mr", "hi", "en"}
ALLOWED_SOIL_TYPES = {
    "deep_black",
    "medium_black",
    "shallow_black",
    "red_loamy",
    "alluvial",
    "laterite",
    "sandy_loam",
    "clay_loam",
}
ALLOWED_IRRIGATION_SOURCES = {
    "rainfed",
    "drip",
    "canal",
    "well",
    "borewell",
    "farm_pond",
    "sprinkler",
}
MOBILE_RE = re.compile(r"^\+?[0-9]{10,13}$")


def require_json_body(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise AppError("INVALID_JSON_BODY", "Request body must be a JSON object.", 400)
    return payload


def validate_login_payload(payload: Any) -> Dict[str, str]:
    data = require_json_body(payload)
    farmer_id = str(data.get("farmer_id") or data.get("username") or "").strip().upper()
    password = str(data.get("password") or "").strip()
    if not farmer_id or not password:
        raise AppError("MISSING_CREDENTIALS", "Both Farmer ID and password are required.", 400)
    if len(farmer_id) > 32 or len(password) > 128:
        raise AppError("INVALID_CREDENTIALS_LENGTH", "Credentials exceed maximum length.", 400)
    return {"farmer_id": farmer_id, "password": password}


def validate_password_change_payload(payload: Any) -> Dict[str, str]:
    data = require_json_body(payload)
    current_password = str(data.get("current_password") or "").strip()
    new_password = str(data.get("new_password") or "").strip()
    if len(new_password) < 8:
        raise AppError(
            "WEAK_PASSWORD",
            "New password must be at least 8 characters long.",
            400,
        )
    if len(new_password) > 128:
        raise AppError("INVALID_PASSWORD", "New password cannot exceed 128 characters.", 400)
    return {"current_password": current_password, "new_password": new_password}


def validate_create_farmer_payload(payload: Any) -> Dict[str, Optional[str]]:
    data = require_json_body(payload)
    name = str(data.get("name") or "").strip()
    if len(name) < 2 or len(name) > 120:
        raise AppError("INVALID_FARMER_NAME", "Farmer name must be between 2 and 120 characters.", 400)

    district = str(data.get("district") or "Ahilya Nagar").strip()
    if district not in ("Ahilya Nagar", "Ahmednagar", "Nashik"):
        raise AppError(
            "UNSUPPORTED_DISTRICT",
            "District must be 'Ahilya Nagar' or 'Nashik'.",
            400,
        )
    if district == "Ahmednagar":
        district = "Ahilya Nagar"

    taluka = str(data.get("taluka") or "").strip()
    if not taluka or len(taluka) > 64:
        raise AppError("INVALID_TALUKA", "Taluka is required (max 64 characters).", 400)

    village = str(data.get("village") or "").strip()[:100]
    lang = str(data.get("preferred_language") or "mr").strip().lower()
    if lang not in ALLOWED_LANGUAGES:
        lang = "mr"

    mobile_raw = str(data.get("mobile") or "").strip()
    if mobile_raw and not MOBILE_RE.match(mobile_raw):
        raise AppError("INVALID_MOBILE", "Mobile number must contain 10 to 13 digits.", 400)

    return {
        "name": name,
        "district": district,
        "taluka": taluka,
        "village": village,
        "preferred_language": lang,
        "mobile": mobile_raw or None,
    }


def validate_create_parcel_payload(payload: Any) -> Dict[str, Any]:
    data = require_json_body(payload)
    name = str(data.get("name") or "Field 1").strip()[:100]
    survey_number = str(data.get("survey_number") or data.get("gat_number") or "").strip()[:64]
    soil_type = str(data.get("soil_type") or "medium_black").strip().lower()
    irrigation_source = str(data.get("irrigation_source") or "rainfed").strip().lower()
    planting_date = str(data.get("planting_date") or "").strip()[:16] or None
    geojson = data.get("geojson") or data.get("geometry")
    if not geojson:
        raise AppError("MISSING_GEOJSON", "Parcel GeoJSON boundary is required.", 400)

    return {
        "name": name,
        "survey_number": survey_number or None,
        "soil_type": soil_type,
        "irrigation_source": irrigation_source,
        "planting_date": planting_date,
        "geojson": geojson,
    }
