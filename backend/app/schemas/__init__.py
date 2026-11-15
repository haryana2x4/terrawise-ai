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
ALLOWED_FARMER_CATEGORIES = {
    "marginal",
    "small",
    "semi_medium",
    "medium",
    "other",
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


def _parse_experience_years(raw: Any) -> Optional[int]:
    if raw is None or str(raw).strip() == "":
        return None
    try:
        years = int(raw)
    except (TypeError, ValueError) as exc:
        raise AppError("INVALID_EXPERIENCE_YEARS", "Experience years must be a whole number.", 400) from exc
    if years < 0 or years > 85:
        raise AppError("INVALID_EXPERIENCE_YEARS", "Experience years must be between 0 and 85.", 400)
    return years


def validate_create_farmer_payload(payload: Any) -> Dict[str, Any]:
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

    holder_relation = str(data.get("holder_relation") or "").strip()[:100] or None
    farmer_category = str(data.get("farmer_category") or "small").strip().lower()
    if farmer_category not in ALLOWED_FARMER_CATEGORIES:
        farmer_category = "small"
    primary_crops = str(data.get("primary_crops") or "").strip()[:160] or None
    exp_years = _parse_experience_years(data.get("farming_experience_years"))
    bio_note = str(data.get("bio_note") or "").strip()[:300] or None

    return {
        "name": name,
        "district": district,
        "taluka": taluka,
        "village": village,
        "preferred_language": lang,
        "mobile": mobile_raw or None,
        "holder_relation": holder_relation,
        "farmer_category": farmer_category,
        "primary_crops": primary_crops,
        "farming_experience_years": exp_years,
        "bio_note": bio_note,
    }


def validate_update_farmer_payload(payload: Any) -> Dict[str, Any]:
    """Validate partial farmer profile updates from the officer console."""
    data = require_json_body(payload)
    updates: Dict[str, Any] = {}

    if "name" in data:
        name = str(data.get("name") or "").strip()
        if len(name) < 2 or len(name) > 120:
            raise AppError("INVALID_FARMER_NAME", "Farmer name must be between 2 and 120 characters.", 400)
        updates["name"] = name

    if "district" in data:
        district = str(data.get("district") or "").strip()
        if district == "Ahmednagar":
            district = "Ahilya Nagar"
        if district not in ("Ahilya Nagar", "Nashik"):
            raise AppError("UNSUPPORTED_DISTRICT", "District must be 'Ahilya Nagar' or 'Nashik'.", 400)
        updates["district"] = district

    if "taluka" in data:
        taluka = str(data.get("taluka") or "").strip()
        if not taluka or len(taluka) > 64:
            raise AppError("INVALID_TALUKA", "Taluka is required (max 64 characters).", 400)
        updates["taluka"] = taluka

    if "village" in data:
        updates["village"] = str(data.get("village") or "").strip()[:100]

    if "preferred_language" in data:
        lang = str(data.get("preferred_language") or "mr").strip().lower()
        updates["preferred_language"] = lang if lang in ALLOWED_LANGUAGES else "mr"

    if "mobile" in data:
        mobile_raw = str(data.get("mobile") or "").strip()
        if mobile_raw and not MOBILE_RE.match(mobile_raw):
            raise AppError("INVALID_MOBILE", "Mobile number must contain 10 to 13 digits.", 400)
        updates["mobile"] = mobile_raw or None

    if "holder_relation" in data:
        updates["holder_relation"] = str(data.get("holder_relation") or "").strip()[:100] or None

    if "farmer_category" in data:
        cat = str(data.get("farmer_category") or "small").strip().lower()
        updates["farmer_category"] = cat if cat in ALLOWED_FARMER_CATEGORIES else "small"

    if "primary_crops" in data:
        updates["primary_crops"] = str(data.get("primary_crops") or "").strip()[:160] or None

    if "farming_experience_years" in data:
        updates["farming_experience_years"] = _parse_experience_years(data.get("farming_experience_years"))

    if "bio_note" in data:
        updates["bio_note"] = str(data.get("bio_note") or "").strip()[:300] or None

    return updates


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
