"""Versioned API v1 Blueprint and route handlers with strict RBAC and object ownership checks."""
from __future__ import annotations

import csv
import io
import json
import secrets
import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import qrcode
import qrcode.image.svg

from flask import Blueprint, Response, current_app, g, jsonify, request, send_file

from app.core import AppError, compute_etag, paginate_list
from app.extensions import db_manager, rate_limiter
from app.integrations import AgmarknetClient, OpenMeteoClient, SoilGridsClient
from app.models import (
    Announcement,
    AssistantMessage,
    AuditLog,
    CropHistory,
    Farmer,
    FeedbackEntry,
    FieldObservation,
    NotificationLog,
    Parcel,
)
from app.repositories import (
    CommunityRepository,
    FarmerRepository,
    ParcelRepository,
    TelemetryRepository,
)
from app.schemas import (
    ALLOWED_IRRIGATION_SOURCES,
    ALLOWED_SOIL_TYPES,
    require_json_body,
    validate_create_farmer_payload,
    validate_create_parcel_payload,
    validate_login_payload,
    validate_password_change_payload,
    validate_update_farmer_payload,
)
from app.security import (
    check_object_ownership,
    create_access_token,
    decrypt_field,
    encrypt_field,
    generate_farmer_id,
    generate_natural_password,
    generate_refresh_token_raw,
    hash_password,
    hash_refresh_token,
    require_auth,
    verify_password,
)

api_v1 = Blueprint("api_v1", __name__)


def _get_services():
    return (
        current_app.extensions["geo_service"],
        current_app.extensions["advice_service"],
        current_app.extensions["card_service"],
        current_app.extensions["assistant_service"],
    )


def _serialize_parcel(parcel: Parcel) -> Dict[str, Any]:
    secret_key = current_app.config["SECRET_KEY"]
    survey_dec = decrypt_field(parcel.survey_number_encrypted, secret_key)
    data = parcel.to_dict(decrypted_survey_number=survey_dec)
    data["crop_history"] = [ch.to_dict() for ch in parcel.crop_history]
    return data


def _serialize_farmer(farmer: Farmer, include_parcels: bool = True) -> Dict[str, Any]:
    secret_key = current_app.config["SECRET_KEY"]
    mobile_dec = decrypt_field(farmer.mobile_encrypted, secret_key)
    data = farmer.to_dict(include_sensitive=True, decrypted_mobile=mobile_dec)
    if include_parcels:
        data["parcels"] = [_serialize_parcel(p) for p in farmer.parcels]
    return data


# ============================================================================
# AUTHENTICATION & DPDP CONSENT
# ============================================================================


@api_v1.route("/auth/login", methods=["POST"])
def auth_login():
    ip = request.remote_addr or "unknown"
    allowed, retry_after = rate_limiter.is_allowed(f"login:{ip}", limit=15, window_seconds=60)
    if not allowed:
        raise AppError("RATE_LIMITED", f"Too many login attempts. Retry after {retry_after}s.", 429)

    creds = validate_login_payload(request.get_json(silent=True))
    farmer_id = creds["farmer_id"]
    password = creds["password"]

    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, farmer_id)
        if not farmer:
            raise AppError("INVALID_CREDENTIALS", "Invalid Farmer ID or password.", 401)

        if farmer.is_locked():
            raise AppError(
                "ACCOUNT_LOCKED",
                "Account is temporarily locked after repeated failed attempts. Wait 15 minutes or ask your administrator to unlock it.",
                423,
                {"locked_until": farmer.locked_until.isoformat() + "Z" if farmer.locked_until else None},
            )

        if not verify_password(password, farmer.password_hash):
            FarmerRepository.record_failed_login(
                session,
                farmer,
                max_attempts=int(current_app.config.get("LOGIN_LOCKOUT_ATTEMPTS", 5)),
                lockout_minutes=int(current_app.config.get("LOGIN_LOCKOUT_MINUTES", 15)),
            )
            CommunityRepository.log_audit(
                session,
                actor_id=farmer_id,
                action="LOGIN_FAILED",
                target_id=farmer_id,
                details={"failed_attempts": farmer.failed_attempts},
                ip_address=ip,
            )
            raise AppError("INVALID_CREDENTIALS", "Invalid Farmer ID or password.", 401)

        FarmerRepository.record_successful_login(session, farmer)
        access_token = create_access_token(
            farmer_id=farmer.farmer_id,
            role=farmer.role,
            secret_key=current_app.config["JWT_SECRET_KEY"],
            expires_minutes=int(current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES_MIN", 30)),
        )
        raw_refresh = generate_refresh_token_raw()
        refresh_hash = hash_refresh_token(raw_refresh)
        family_id = secrets.token_hex(16)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=int(current_app.config.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 7))
        )
        FarmerRepository.issue_refresh_token(
            session,
            farmer_id=farmer.farmer_id,
            token_hash=refresh_hash,
            family_id=family_id,
            expires_at=expires_at,
        )
        CommunityRepository.log_audit(
            session,
            actor_id=farmer.farmer_id,
            action="LOGIN_SUCCESS",
            target_id=farmer.farmer_id,
            ip_address=ip,
        )
        profile = _serialize_farmer(farmer, include_parcels=True)

    resp = jsonify(
        {
            "access_token": access_token,
            "token": access_token,
            "refresh_token": raw_refresh,
            "farmer": profile,
        }
    )
    resp.set_cookie(
        "kshetra_refresh",
        raw_refresh,
        httponly=True,
        samesite="Lax",
        secure=not current_app.config.get("DEBUG", False),
        max_age=7 * 86400,
    )
    return resp, 200


@api_v1.route("/auth/refresh", methods=["POST"])
def auth_refresh():
    body = request.get_json(silent=True) or {}
    raw_token = body.get("refresh_token") or request.cookies.get("kshetra_refresh")
    if not raw_token:
        raise AppError("MISSING_REFRESH_TOKEN", "Refresh token is required.", 401)

    old_hash = hash_refresh_token(str(raw_token))
    new_raw = generate_refresh_token_raw()
    new_hash = hash_refresh_token(new_raw)
    new_expires = datetime.now(timezone.utc) + timedelta(
        days=int(current_app.config.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", 7))
    )

    with db_manager.session_scope() as session:
        farmer, _ = FarmerRepository.rotate_refresh_token(
            session,
            old_token_hash=old_hash,
            new_token_hash=new_hash,
            new_expires_at=new_expires,
        )
        access_token = create_access_token(
            farmer_id=farmer.farmer_id,
            role=farmer.role,
            secret_key=current_app.config["JWT_SECRET_KEY"],
            expires_minutes=int(current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES_MIN", 30)),
        )
        profile = _serialize_farmer(farmer, include_parcels=True)

    resp = jsonify(
        {
            "access_token": access_token,
            "token": access_token,
            "refresh_token": new_raw,
            "farmer": profile,
        }
    )
    resp.set_cookie(
        "kshetra_refresh",
        new_raw,
        httponly=True,
        samesite="Lax",
        secure=not current_app.config.get("DEBUG", False),
        max_age=7 * 86400,
    )
    return resp, 200


@api_v1.route("/auth/logout", methods=["POST"])
@require_auth()
def auth_logout():
    with db_manager.session_scope() as session:
        FarmerRepository.revoke_all_refresh_tokens(session, g.current_farmer_id)
    resp = jsonify({"status": "logged_out"})
    resp.delete_cookie("kshetra_refresh")
    return resp, 200


@api_v1.route("/auth/change-password", methods=["POST"])
@require_auth()
def auth_change_password():
    data = validate_password_change_payload(request.get_json(silent=True))
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account not found.", 404)
        if data["current_password"] and not verify_password(data["current_password"], farmer.password_hash):
            raise AppError("INVALID_CURRENT_PASSWORD", "Current password is incorrect.", 400)

        farmer.password_hash = hash_password(data["new_password"])
        farmer.must_change_password = False
        FarmerRepository.revoke_all_refresh_tokens(session, farmer.farmer_id)
        CommunityRepository.log_audit(
            session,
            actor_id=farmer.farmer_id,
            action="CHANGE_PASSWORD",
            target_id=farmer.farmer_id,
            ip_address=request.remote_addr,
        )
        profile = _serialize_farmer(farmer, include_parcels=True)
    return jsonify({"status": "password_updated", "farmer": profile}), 200


@api_v1.route("/auth/consent", methods=["POST"])
@require_auth()
def auth_accept_consent():
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account not found.", 404)
        farmer.consent_accepted_at = datetime.now(timezone.utc).replace(tzinfo=None)
        CommunityRepository.log_audit(
            session,
            actor_id=farmer.farmer_id,
            action="ACCEPT_DPDP_CONSENT",
            target_id=farmer.farmer_id,
            ip_address=request.remote_addr,
        )
        session.commit()
        profile = _serialize_farmer(farmer, include_parcels=True)
    return jsonify({"status": "consent_recorded", "farmer": profile}), 200


@api_v1.route("/auth/me", methods=["GET"])
@require_auth()
def auth_me():
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account not found.", 404)
        return jsonify({"farmer": _serialize_farmer(farmer, include_parcels=True)}), 200


# ============================================================================
# FARMER SELF-SERVICE PROFILE, DPDP DATA EXPORT & DELETE-MY-DATA
# ============================================================================


@api_v1.route("/farmers/me", methods=["PATCH"])
@require_auth()
def update_my_profile():
    body = require_json_body(request.get_json(silent=True))
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account not found.", 404)
        if "preferred_language" in body and body["preferred_language"] in ("mr", "hi", "en"):
            farmer.preferred_language = body["preferred_language"]
        if "village" in body:
            farmer.village = str(body["village"] or "").strip()[:100]
        if "mobile" in body:
            mob = str(body["mobile"] or "").strip()
            farmer.mobile_encrypted = (
                encrypt_field(mob, current_app.config["SECRET_KEY"]) if mob else None
            )
        session.commit()
        return jsonify({"farmer": _serialize_farmer(farmer, include_parcels=True)}), 200


@api_v1.route("/farmers/me/export", methods=["GET"])
@require_auth()
def export_my_data():
    """DPDP Act 2023 Right to Data Portability: export all personal and agronomic data as JSON."""
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account not found.", 404)
        observations = (
            session.query(FieldObservation)
            .filter(FieldObservation.farmer_id == farmer.farmer_id)
            .all()
        )
        messages = (
            session.query(AssistantMessage)
            .filter(AssistantMessage.farmer_id == farmer.farmer_id)
            .all()
        )
        export_bundle = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "compliance_standard": "India Digital Personal Data Protection (DPDP) Act 2023",
            "profile": _serialize_farmer(farmer, include_parcels=True),
            "field_observations": [o.to_dict() for o in observations],
            "assistant_messages": [m.to_dict() for m in messages],
        }
        CommunityRepository.log_audit(
            session,
            actor_id=farmer.farmer_id,
            action="EXPORT_PERSONAL_DATA",
            target_id=farmer.farmer_id,
            ip_address=request.remote_addr,
        )
    return jsonify(export_bundle), 200


@api_v1.route("/farmers/me", methods=["DELETE"])
@require_auth()
def delete_my_account():
    """DPDP Act 2023 Right to Erasure: permanently delete farmer's account and parcels."""
    body = request.get_json(silent=True) or {}
    password = str(body.get("password") or "").strip()
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account not found.", 404)
        if farmer.role == "admin":
            raise AppError("CANNOT_DELETE_ADMIN", "Administrator account cannot be self-deleted.", 400)
        if password and not verify_password(password, farmer.password_hash):
            raise AppError("INVALID_PASSWORD", "Password confirmation failed.", 401)

        FarmerRepository.delete_farmer_and_data(
            session, farmer, actor_id=farmer.farmer_id, ip_address=request.remote_addr
        )
    return jsonify({"status": "deleted", "message": "All personal data and parcels have been erased."}), 200


# ============================================================================
# PARCELS, GEOMETRY VALIDATION, CROP HISTORY & FIELD OBSERVATIONS
# ============================================================================


@api_v1.route("/parcels", methods=["GET"])
@require_auth()
def list_parcels():
    target_farmer_id = request.args.get("farmer_id") or g.current_farmer_id
    check_object_ownership(target_farmer_id)
    with db_manager.session_scope() as session:
        parcels = session.query(Parcel).filter(Parcel.farmer_id == target_farmer_id).all()
        return jsonify({"parcels": [_serialize_parcel(p) for p in parcels]}), 200


@api_v1.route("/parcels/validate", methods=["POST"])
@require_auth()
def validate_parcel_geometry():
    geo_service, _, _, _ = _get_services()
    body = require_json_body(request.get_json(silent=True))
    geom = body.get("geojson") or body.get("geometry") or body
    measured = geo_service.validate_and_measure_polygon(geom)
    with db_manager.session_scope() as session:
        all_parcels = session.query(Parcel).all()
        existing_tuples = [(p.id, p.farmer_id, p.geojson) for p in all_parcels]
        has_overlap, overlap_msg = geo_service.check_overlap(measured["geojson"], existing_tuples)
        measured["has_overlap"] = has_overlap
        measured["overlap_message"] = overlap_msg
    return jsonify(measured), 200


@api_v1.route("/parcels/import", methods=["POST"])
@require_auth()
def import_parcel_file():
    geo_service, _, _, _ = _get_services()
    if "file" in request.files:
        f = request.files["file"]
        raw_bytes = f.read()
        filename = f.filename or "upload.geojson"
    else:
        body = require_json_body(request.get_json(silent=True))
        content = str(body.get("content") or "")
        filename = str(body.get("filename") or "upload.geojson")
        raw_bytes = content.encode("utf-8")

    measured = geo_service.parse_import_file(filename, raw_bytes)
    return jsonify(measured), 200


@api_v1.route("/parcels", methods=["POST"])
@require_auth()
def create_parcel():
    geo_service, _, _, _ = _get_services()
    payload = validate_create_parcel_payload(request.get_json(silent=True))
    target_farmer_id = str(
        (request.get_json(silent=True) or {}).get("farmer_id") or g.current_farmer_id
    ).strip()
    check_object_ownership(target_farmer_id)

    measured = geo_service.validate_and_measure_polygon(payload["geojson"])
    survey_enc = (
        encrypt_field(payload["survey_number"], current_app.config["SECRET_KEY"])
        if payload["survey_number"]
        else None
    )

    created = ParcelRepository.create_parcel_atomic(
        db_manager,
        farmer_id=target_farmer_id,
        name=payload["name"],
        survey_number_encrypted=survey_enc,
        geojson_str=measured["geojson"],
        area_acres=measured["area_acres"],
        area_gunthas=measured["area_gunthas"],
        centroid_lat=measured["centroid_lat"],
        centroid_lon=measured["centroid_lon"],
        soil_type=payload["soil_type"],
        irrigation_source=payload["irrigation_source"],
        planting_date=payload["planting_date"],
        overlap_checker=geo_service.check_overlap,
        max_parcels=int(current_app.config.get("MAX_PARCELS_PER_FARMER", 4)),
    )
    created["survey_number"] = payload["survey_number"]
    return jsonify({"parcel": created, "measurements": measured}), 201


@api_v1.route("/parcels/<int:parcel_id>", methods=["PATCH"])
@require_auth()
def update_parcel(parcel_id: int):
    """Update parcel metadata or re-validated boundary geometry with RBAC ownership checks."""
    geo_service, _, _, _ = _get_services()
    body = require_json_body(request.get_json(silent=True))

    with db_manager.session_scope() as session:
        parcel = session.query(Parcel).filter(Parcel.id == parcel_id).first()
        if not parcel:
            raise AppError("PARCEL_NOT_FOUND", "Parcel not found.", 404)
        check_object_ownership(parcel.farmer_id)

        if "name" in body and str(body["name"]).strip():
            parcel.name = str(body["name"]).strip()[:120]
        if "survey_number" in body:
            survey_raw = str(body["survey_number"] or "").strip()[:64]
            parcel.survey_number_encrypted = (
                encrypt_field(survey_raw, current_app.config["SECRET_KEY"]) if survey_raw else None
            )
        if "soil_type" in body and body["soil_type"] is not None:
            soil_val = str(body["soil_type"]).strip().lower()
            if soil_val not in ALLOWED_SOIL_TYPES:
                raise AppError("INVALID_SOIL_TYPE", f"Unsupported soil_type: {soil_val}", 400)
            parcel.soil_type = soil_val
        if "irrigation_source" in body and body["irrigation_source"] is not None:
            irr_val = str(body["irrigation_source"]).strip().lower()
            if irr_val not in ALLOWED_IRRIGATION_SOURCES:
                raise AppError("INVALID_IRRIGATION_SOURCE", f"Unsupported irrigation_source: {irr_val}", 400)
            parcel.irrigation_source = irr_val
        if "planting_date" in body:
            parcel.planting_date = str(body["planting_date"] or "").strip()[:16] or None
        if "geojson" in body and body["geojson"]:
            measured = geo_service.validate_and_measure_polygon(body["geojson"])
            others = [
                (p.id, p.farmer_id, p.geojson)
                for p in session.query(Parcel).filter(Parcel.id != parcel.id).all()
            ]
            has_overlap, overlap_msg = geo_service.check_overlap(measured["geojson"], others)
            if has_overlap:
                raise AppError("PARCEL_OVERLAP", overlap_msg or "Polygon overlaps another parcel.", 409)
            parcel.geojson = measured["geojson"]
            parcel.area_acres = measured["area_acres"]
            parcel.area_gunthas = measured["area_gunthas"]
            parcel.centroid_lat = measured["centroid_lat"]
            parcel.centroid_lon = measured["centroid_lon"]

        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="UPDATE_PARCEL",
            target_id=str(parcel_id),
            ip_address=request.remote_addr,
        )
        session.commit()
        session.refresh(parcel)
        updated = _serialize_parcel(parcel)
    return jsonify({"parcel": updated}), 200


@api_v1.route("/parcels/<int:parcel_id>", methods=["DELETE"])
@require_auth()
def delete_parcel(parcel_id: int):
    with db_manager.session_scope() as session:
        parcel = session.query(Parcel).filter(Parcel.id == parcel_id).first()
        if not parcel:
            raise AppError("PARCEL_NOT_FOUND", "Parcel not found.", 404)
        check_object_ownership(parcel.farmer_id)
        session.delete(parcel)
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="DELETE_PARCEL",
            target_id=str(parcel_id),
            ip_address=request.remote_addr,
        )
        session.commit()
    return jsonify({"status": "deleted", "parcel_id": parcel_id}), 200


@api_v1.route("/parcels/<int:parcel_id>/history", methods=["GET", "POST"])
@require_auth()
def parcel_crop_history(parcel_id: int):
    with db_manager.session_scope() as session:
        parcel = session.query(Parcel).filter(Parcel.id == parcel_id).first()
        if not parcel:
            raise AppError("PARCEL_NOT_FOUND", "Parcel not found.", 404)
        check_object_ownership(parcel.farmer_id)

        if request.method == "GET":
            return jsonify({"history": [ch.to_dict() for ch in parcel.crop_history]}), 200

        body = require_json_body(request.get_json(silent=True))
        crop_id = str(body.get("crop_id") or "").strip()
        crop_name = str(body.get("crop_name") or crop_id).strip()
        season = str(body.get("season") or "kharif").strip().lower()
        year = int(body.get("year") or datetime.now(timezone.utc).year)
        yield_val = float(body["yield_quintals"]) if body.get("yield_quintals") is not None else None
        notes = str(body.get("notes") or "").strip()[:300] or None

        if not crop_id:
            raise AppError("MISSING_CROP_ID", "crop_id is required.", 400)

        entry = CropHistory(
            parcel_id=parcel.id,
            crop_id=crop_id,
            crop_name=crop_name,
            season=season,
            year=year,
            yield_quintals=yield_val,
            notes=notes,
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return jsonify({"entry": entry.to_dict()}), 201


@api_v1.route("/parcels/<int:parcel_id>/observations", methods=["GET", "POST"])
@require_auth()
def parcel_observations(parcel_id: int):
    with db_manager.session_scope() as session:
        parcel = session.query(Parcel).filter(Parcel.id == parcel_id).first()
        if not parcel:
            raise AppError("PARCEL_NOT_FOUND", "Parcel not found.", 404)
        check_object_ownership(parcel.farmer_id)

        if request.method == "GET":
            rows = (
                session.query(FieldObservation)
                .filter(FieldObservation.parcel_id == parcel.id)
                .order_by(FieldObservation.observed_date.desc())
                .all()
            )
            return jsonify({"observations": [r.to_dict() for r in rows]}), 200

        body = require_json_body(request.get_json(silent=True))
        obs = FieldObservation(
            farmer_id=parcel.farmer_id,
            parcel_id=parcel.id,
            observed_date=str(body.get("observed_date") or datetime.now(timezone.utc).strftime("%Y-%m-%d"))[:16],
            rain_mm=float(body["rain_mm"]) if body.get("rain_mm") is not None else None,
            soil_moisture_state=str(body.get("soil_moisture_state") or "").strip()[:32] or None,
            pest_seen=str(body.get("pest_seen") or "").strip()[:120] or None,
            notes=str(body.get("notes") or "").strip()[:400] or None,
        )
        session.add(obs)
        session.commit()
        session.refresh(obs)
        return jsonify({"observation": obs.to_dict()}), 201


@api_v1.route("/geo/boundaries", methods=["GET"])
@api_v1.route("/geo/districts", methods=["GET"])
@api_v1.route("/geo/talukas", methods=["GET"])
def get_geo_boundaries():
    if request.path.endswith("/talukas"):
        layer = "talukas"
    elif request.path.endswith("/districts"):
        layer = "districts"
    else:
        layer = (request.args.get("layer") or "districts").lower()
    data_dir = current_app.config["DATA_DIR"]
    filename = "talukas_display.geojson" if layer == "talukas" else "districts_display.geojson"
    target = data_dir / "geo" / filename
    if not target.exists():
        target = data_dir / "geo" / ("talukas.geojson" if layer == "talukas" else "districts.geojson")
    if not target.exists():
        raise AppError("GEO_FILE_MISSING", f"Boundary file {filename} not found.", 404)

    raw_bytes = target.read_bytes()
    etag = compute_etag(raw_bytes)
    if request.headers.get("If-None-Match") == etag:
        return Response(status=304)

    resp = Response(raw_bytes, mimetype="application/geo+json")
    resp.headers["ETag"] = etag
    resp.headers["Cache-Control"] = "public, max-age=86400"
    return resp


@api_v1.route("/public/district-summary", methods=["GET"])
def get_public_district_summary():
    """Return live or cached Open-Meteo temperatures for Ahilya Nagar and Nashik; null if unavailable."""
    skip_net = bool(current_app.config.get("TESTING", False))
    districts_cfg = [
        {"district_en": "Ahilya Nagar", "district_mr": "अहिल्यानगर", "lat": 19.09, "lon": 74.74},
        {"district_en": "Nashik", "district_mr": "नाशिक", "lat": 20.00, "lon": 73.79},
    ]
    out = []
    with db_manager.session_scope() as session:
        for d in districts_cfg:
            w = OpenMeteoClient.fetch_weather(d["lat"], d["lon"], db_session=session, skip_network=skip_net)
            temp_val = (w.get("current", {}).get("temperature_c") or {}).get("value")
            prov = w.get("provenance") or {}
            out.append(
                {
                    "district_en": d["district_en"],
                    "district_mr": d["district_mr"],
                    "temperature_c": temp_val,
                    "rain_probability_pct": None,
                    "source": prov.get("source", "Open-Meteo"),
                    "observed_at": prov.get("label", "No data"),
                }
            )
    return jsonify({"districts": out}), 200


@api_v1.route("/farmer/dashboard", methods=["GET"])
@require_auth()
def get_farmer_dashboard():
    """Unified dashboard payload for FarmerHome combining real parcels, weather, suitability, announcements, and observations."""
    _, advice_service, _, _ = _get_services()
    lang = (request.args.get("lang") or "mr").lower()
    skip_net = bool(current_app.config.get("TESTING", False))

    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Farmer account not found.", 404)

        parcels_serialized = [_serialize_parcel(p) for p in farmer.parcels]
        for p_dict in parcels_serialized:
            p_dict["area_acre"] = p_dict["area_acres"]
            p_dict["area_guntha"] = p_dict["area_gunthas"]
            p_dict["village"] = farmer.village
            p_dict["taluka"] = farmer.taluka
            p_dict["district"] = farmer.district
            p_dict["parcel_number"] = p_dict["id"]
            p_dict["centroid"] = {"lat": p_dict["centroid_lat"], "lon": p_dict["centroid_lon"]}
            p_dict["boundary_source"] = "Verified 7/12" if p_dict["land_verified"] else "WGS84 Geodesic"

        requested_pid = request.args.get("parcel_id", type=int)
        active_parcel = next(
            (p for p in parcels_serialized if requested_pid and p["id"] == requested_pid),
            parcels_serialized[0] if parcels_serialized else None,
        )
        lat = active_parcel["centroid_lat"] if active_parcel else 19.39
        lon = active_parcel["centroid_lon"] if active_parcel else 74.65
        soil_type = active_parcel["soil_type"] if active_parcel else "medium_black"
        irrigation = active_parcel["irrigation_source"] if active_parcel else "rainfed"
        prev_crop = (
            active_parcel["crop_history"][0]["crop_id"]
            if active_parcel and active_parcel.get("crop_history")
            else None
        )

        weather = OpenMeteoClient.fetch_weather(lat, lon, db_session=session, skip_network=skip_net)
        suitability = advice_service.evaluate_crop_suitability(
            soil_type=soil_type,
            irrigation_source=irrigation,
            season="auto",
            weather=weather,
            previous_crop_id=prev_crop,
            lang=lang,
        )
        risks = advice_service.evaluate_risks_and_pests(weather=weather, lang=lang)
        precision_analytics = advice_service.compute_precision_agronomy(
            weather=weather,
            suitability=suitability,
            parcel=active_parcel,
            lang=lang,
        )

        # Announcements for farmer's district/taluka
        ann_rows = (
            session.query(Announcement)
            .filter(Announcement.active.is_(True))
            .order_by(Announcement.created_at.desc())
            .limit(10)
            .all()
        )
        announcements = [
            a.to_dict()
            for a in ann_rows
            if a.district in (farmer.district, "All")
            and (not a.taluka or a.taluka in (farmer.taluka, "All"))
        ]

        # Field observations
        obs_rows = (
            session.query(FieldObservation)
            .filter(FieldObservation.farmer_id == farmer.farmer_id)
            .order_by(FieldObservation.observed_date.desc())
            .limit(15)
            .all()
        )
        observations = [o.to_dict() for o in obs_rows]

        alerts = risks.get("alerts") or []
        traffic_light = "red" if any(a["severity"] == "high" for a in alerts) else ("yellow" if alerts else "green")
        if weather.get("status") == "unavailable":
            one_sentence_mr = "सध्या थेट हवामान डेटा उपलब्ध नाही (माहिती नाही)."
            one_sentence_hi = "वर्तमान में लाइव मौसम डेटा उपलब्ध नहीं है (कोई जानकारी नहीं)।"
            one_sentence_en = "Live weather telemetry is currently unavailable (No data)."
            one_action_mr = "आजच्या पावसाची किंवा निरीक्षणाची नोंद खालील फॉर्ममध्ये करा."
            one_action_hi = "आज की बारिश या खेत का अवलोकन नीचे दिए फॉर्म में दर्ज करें।"
            one_action_en = "Log today's field rainfall or observation below."
        elif alerts:
            top_alert = alerts[0]
            t_i18n = top_alert.get("title_i18n") or {}
            a_i18n = top_alert.get("action_i18n") or {}
            one_sentence_mr = t_i18n.get("mr") or top_alert["title"]
            one_sentence_hi = t_i18n.get("hi") or top_alert["title"]
            one_sentence_en = t_i18n.get("en") or top_alert["title"]
            one_action_mr = a_i18n.get("mr") or top_alert["action"]
            one_action_hi = a_i18n.get("hi") or top_alert["action"]
            one_action_en = a_i18n.get("en") or top_alert["action"]
        else:
            one_sentence_mr = "पुढील ७ दिवसांत गंभीर हवामान धोका नाही."
            one_sentence_hi = "अगले 7 दिनों में कोई गंभीर मौसम खतरा नहीं है।"
            one_sentence_en = "No severe weather risk detected for the next 7 days."
            one_action_mr = "मातीतील ओलावा तपासून गरजेनुसार सिंचन व चिकट सापळ्यांची पाहणी करा."
            one_action_hi = "मिट्टी की नमी जांचकर आवश्यकतानुसार सिंचाई करें और पीले चिपचिपे ट्रैप देखें।"
            one_action_en = "Inspect soil moisture before irrigating and check IPM sticky traps."

        profile = _serialize_farmer(farmer, include_parcels=True)
        profile["full_name"] = farmer.name

    return (
        jsonify(
            {
                "success": True,
                "farmer": profile,
                "parcels": parcels_serialized,
                "weather": weather,
                "suitability": suitability,
                "risks": risks,
                "precision_analytics": precision_analytics,
                "announcements": announcements,
                "observations": observations,
                "today_card": {
                    "greeting_mr": f"राम राम, {farmer.name}!",
                    "greeting_hi": f"राम राम, {farmer.name} जी!",
                    "greeting_en": f"Welcome, {farmer.name}!",
                    "one_sentence_mr": one_sentence_mr,
                    "one_sentence_hi": one_sentence_hi,
                    "one_sentence_en": one_sentence_en,
                    "one_action_mr": one_action_mr,
                    "one_action_hi": one_action_hi,
                    "one_action_en": one_action_en,
                    "traffic_light": traffic_light,
                    "active_parcel": active_parcel,
                },
            }
        ),
        200,
    )


# ============================================================================
# CLIMATE, SOIL, WATER, CROPS, ADVICE, RISK, PESTS & MARKETS
# ============================================================================


@api_v1.route("/climate", methods=["GET"])
@require_auth()
def get_climate():
    lat = float(request.args.get("lat") or 19.39)
    lon = float(request.args.get("lon") or 74.65)
    skip_net = bool(current_app.config.get("TESTING", False))
    with db_manager.session_scope() as session:
        weather = OpenMeteoClient.fetch_weather(lat, lon, db_session=session, skip_network=skip_net)
    return jsonify(weather), 200


@api_v1.route("/soil", methods=["GET"])
@require_auth()
def get_soil():
    lat = float(request.args.get("lat") or 19.39)
    lon = float(request.args.get("lon") or 74.65)
    declared = request.args.get("soil_type")
    skip_net = bool(current_app.config.get("TESTING", False))
    with db_manager.session_scope() as session:
        profile = SoilGridsClient.fetch_soil_profile(
            lat, lon, declared_soil_type=declared, db_session=session, skip_network=skip_net
        )
    return jsonify(profile), 200


@api_v1.route("/water", methods=["GET"])
@require_auth()
def get_water():
    _, advice_service, _, _ = _get_services()
    lat = float(request.args.get("lat") or 19.39)
    lon = float(request.args.get("lon") or 74.65)
    irrigation = request.args.get("irrigation_source") or "rainfed"
    skip_net = bool(current_app.config.get("TESTING", False))
    with db_manager.session_scope() as session:
        weather = OpenMeteoClient.fetch_weather(lat, lon, db_session=session, skip_network=skip_net)
    indices = advice_service.compute_agronomic_indices(weather, irrigation)
    return (
        jsonify(
            {
                "soil_moisture": weather.get("current", {}).get("soil_moisture_m3m3"),
                "rain_7d_forecast_mm": weather.get("summary", {}).get("rain_7d_forecast_mm"),
                "rain_30d_total_mm": weather.get("summary", {}).get("rain_30d_total_mm"),
                "et0_7d_total_mm": weather.get("summary", {}).get("et0_7d_total_mm"),
                "rshi": indices.get("rshi_score"),
                "vpd": indices.get("vpd_kpa"),
                "provenance": weather.get("provenance"),
            }
        ),
        200,
    )


@api_v1.route("/crops", methods=["GET"])
def get_crops_catalog():
    _, advice_service, _, _ = _get_services()
    payload = json.dumps(
        {"crops": advice_service.crops, "glossary": advice_service.glossary},
        ensure_ascii=False,
    )
    etag = compute_etag(payload)
    if request.headers.get("If-None-Match") == etag:
        return Response(status=304)
    resp = Response(payload, mimetype="application/json")
    resp.headers["ETag"] = etag
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp


@api_v1.route("/advice", methods=["GET", "POST"])
@require_auth()
def get_agronomic_advice():
    _, advice_service, _, _ = _get_services()
    params = (request.get_json(silent=True) or {}) if request.method == "POST" else request.args
    parcel_id = params.get("parcel_id")
    lang = str(params.get("lang") or "mr").lower()
    season = str(params.get("season") or "auto").lower()
    skip_net = bool(current_app.config.get("TESTING", False))

    with db_manager.session_scope() as session:
        soil_type = str(params.get("soil_type") or "medium_black")
        irrigation = str(params.get("irrigation_source") or "rainfed")
        lat = float(params.get("lat") or 19.39)
        lon = float(params.get("lon") or 74.65)
        prev_crop: Optional[str] = params.get("previous_crop_id")

        if parcel_id:
            parcel = session.query(Parcel).filter(Parcel.id == int(parcel_id)).first()
            if parcel:
                check_object_ownership(parcel.farmer_id)
                soil_type = parcel.soil_type
                irrigation = parcel.irrigation_source
                lat = parcel.centroid_lat
                lon = parcel.centroid_lon
                if parcel.crop_history:
                    prev_crop = parcel.crop_history[0].crop_id

        weather = OpenMeteoClient.fetch_weather(lat, lon, db_session=session, skip_network=skip_net)
        suitability = advice_service.evaluate_crop_suitability(
            soil_type=soil_type,
            irrigation_source=irrigation,
            season=season,
            weather=weather,
            previous_crop_id=prev_crop,
            lang=lang,
        )
        risks = advice_service.evaluate_risks_and_pests(weather=weather, lang=lang)

    return jsonify({"weather": weather, "suitability": suitability, "risks": risks}), 200


@api_v1.route("/risk", methods=["GET"])
@api_v1.route("/pests", methods=["GET"])
@require_auth()
def get_risk_and_pests():
    _, advice_service, _, _ = _get_services()
    lat = float(request.args.get("lat") or 19.39)
    lon = float(request.args.get("lon") or 74.65)
    lang = str(request.args.get("lang") or "mr").lower()
    crop_id = request.args.get("crop_id")
    skip_net = bool(current_app.config.get("TESTING", False))
    with db_manager.session_scope() as session:
        weather = OpenMeteoClient.fetch_weather(lat, lon, db_session=session, skip_network=skip_net)
    result = advice_service.evaluate_risks_and_pests(weather=weather, crop_id=crop_id, lang=lang)
    return jsonify(result), 200


@api_v1.route("/markets", methods=["GET"])
@require_auth()
def get_markets():
    district = request.args.get("district") or "Ahilya Nagar"
    commodity = request.args.get("commodity")
    api_key = current_app.config.get("AGMARKNET_API_KEY", "")
    with db_manager.session_scope() as session:
        data = AgmarknetClient.fetch_market_prices(
            api_key=api_key, district=district, commodity=commodity, db_session=session
        )
    return jsonify(data), 200


# ============================================================================
# KRISHI MITRA ASSISTANT (PHASE 4.2)
# ============================================================================


@api_v1.route("/assistant/chat", methods=["POST"])
@require_auth()
def assistant_chat():
    _, _, _, assistant_service = _get_services()
    body = require_json_body(request.get_json(silent=True))
    message = str(body.get("message") or "")
    lang = str(body.get("language") or body.get("lang") or "mr").lower()
    parcel_id = int(body["parcel_id"]) if body.get("parcel_id") is not None else None
    skip_net = bool(current_app.config.get("TESTING", False))

    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account not found.", 404)
        reply = assistant_service.chat(
            session,
            farmer=farmer,
            message=message,
            lang=lang,
            parcel_id=parcel_id,
            skip_network=skip_net,
        )
    return jsonify(reply), 200


@api_v1.route("/assistant/history", methods=["GET", "DELETE"])
@require_auth()
def assistant_history():
    with db_manager.session_scope() as session:
        if request.method == "DELETE":
            session.query(AssistantMessage).filter(
                AssistantMessage.farmer_id == g.current_farmer_id
            ).delete()
            session.commit()
            return jsonify({"status": "cleared"}), 200

        rows = (
            session.query(AssistantMessage)
            .filter(AssistantMessage.farmer_id == g.current_farmer_id)
            .order_by(AssistantMessage.created_at.asc())
            .limit(100)
            .all()
        )
        return jsonify({"messages": [r.to_dict() for r in rows]}), 200


@api_v1.route("/assistant/feedback", methods=["POST"])
@require_auth()
def assistant_feedback():
    body = require_json_body(request.get_json(silent=True))
    msg_id = int(body.get("message_id") or 0)
    rating = int(body.get("rating") or 0)
    if rating not in (-1, 1):
        raise AppError("INVALID_RATING", "Rating must be 1 (helpful) or -1 (not helpful).", 400)

    with db_manager.session_scope() as session:
        msg = (
            session.query(AssistantMessage)
            .filter(
                AssistantMessage.id == msg_id,
                AssistantMessage.farmer_id == g.current_farmer_id,
            )
            .first()
        )
        if not msg:
            raise AppError("MESSAGE_NOT_FOUND", "Assistant message not found.", 404)
        msg.feedback_rating = rating
        session.commit()
        return jsonify({"message": msg.to_dict()}), 200


@api_v1.route("/assistant/translate", methods=["POST"])
@require_auth()
def assistant_translate():
    """Translate assistant guidance or field advisory text into Marathi, Hindi, or English."""
    _, _, _, assistant_service = _get_services()
    body = require_json_body(request.get_json(silent=True))
    target_lang = str(body.get("target_lang") or body.get("language") or "").strip().lower()
    if target_lang not in ("mr", "hi", "en"):
        raise AppError("INVALID_LANGUAGE", "target_lang must be 'mr', 'hi', or 'en'.", 400)

    source_lang = str(body.get("source_lang") or "").strip().lower() or None
    text = str(body.get("text") or "").strip()
    message_id = body.get("message_id")
    skip_net = bool(current_app.config.get("TESTING", False))

    if not text and message_id is not None:
        with db_manager.session_scope() as session:
            msg = (
                session.query(AssistantMessage)
                .filter(
                    AssistantMessage.id == int(message_id),
                    AssistantMessage.farmer_id == g.current_farmer_id,
                )
                .first()
            )
            if not msg:
                raise AppError("MESSAGE_NOT_FOUND", "Assistant message not found.", 404)
            text = msg.content or ""
            source_lang = source_lang or msg.language

    if not text:
        raise AppError("EMPTY_TEXT", "Text to translate cannot be empty.", 400)

    result = assistant_service.translate_text(
        text=text,
        target_lang=target_lang,
        source_lang=source_lang,
        skip_network=skip_net,
    )
    return jsonify({"success": True, **result}), 200


# ============================================================================
# ANNOUNCEMENTS, FEEDBACK, NOTIFICATIONS & PDF CREDENTIAL CARDS (PHASE 5)
# ============================================================================


@api_v1.route("/announcements", methods=["GET", "POST"])
@require_auth()
def handle_announcements():
    with db_manager.session_scope() as session:
        if request.method == "GET":
            farmer = FarmerRepository.get_by_farmer_id(session, g.current_farmer_id)
            q = session.query(Announcement).filter(Announcement.active.is_(True))
            rows = q.order_by(Announcement.created_at.desc()).limit(30).all()
            if farmer and farmer.role != "admin":
                filtered = [
                    r.to_dict()
                    for r in rows
                    if r.district in (farmer.district, "All")
                    and (not r.taluka or r.taluka in (farmer.taluka, "All"))
                ]
                return jsonify({"announcements": filtered}), 200
            return jsonify({"announcements": [r.to_dict() for r in rows]}), 200

        if g.current_role != "admin":
            raise AppError("FORBIDDEN", "Only administrators can publish announcements.", 403)

        body = require_json_body(request.get_json(silent=True))
        title_mr = str(body.get("title_mr") or body.get("title_en") or "").strip()
        title_hi = str(body.get("title_hi") or title_mr).strip()
        title_en = str(body.get("title_en") or title_mr).strip()
        body_mr = str(body.get("body_mr") or body.get("body_en") or "").strip()
        body_hi = str(body.get("body_hi") or body_mr).strip()
        body_en = str(body.get("body_en") or body_mr).strip()
        if not title_en or not body_en:
            raise AppError("MISSING_ANNOUNCEMENT_TEXT", "Announcement title and body are required.", 400)

        ann = Announcement(
            district=str(body.get("district") or "Ahilya Nagar").strip(),
            taluka=str(body.get("taluka") or "").strip() or None,
            severity=str(body.get("severity") or "info").strip(),
            title_mr=title_mr,
            title_hi=title_hi,
            title_en=title_en,
            body_mr=body_mr,
            body_hi=body_hi,
            body_en=body_en,
            created_by=g.current_farmer_id,
            active=True,
        )
        session.add(ann)
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="PUBLISH_ANNOUNCEMENT",
            details={"district": ann.district, "taluka": ann.taluka, "title": title_en},
            ip_address=request.remote_addr,
        )
        session.commit()
        session.refresh(ann)
        return jsonify({"announcement": ann.to_dict()}), 201


@api_v1.route("/feedback", methods=["POST"])
@require_auth()
def submit_feedback():
    body = require_json_body(request.get_json(silent=True))
    target_type = str(body.get("target_type") or "problem_report").strip()[:32]
    target_ref = str(body.get("target_ref") or "").strip()[:64] or None
    rating = int(body["rating"]) if body.get("rating") is not None else None
    comment = str(body.get("comment") or "").strip()[:500] or None

    with db_manager.session_scope() as session:
        entry = FeedbackEntry(
            farmer_id=g.current_farmer_id,
            target_type=target_type,
            target_ref=target_ref,
            rating=rating,
            comment=comment,
        )
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return jsonify({"feedback": entry.to_dict()}), 201


@api_v1.route("/notifications", methods=["GET"])
@require_auth()
def list_notifications():
    with db_manager.session_scope() as session:
        q = session.query(NotificationLog)
        if g.current_role != "admin":
            q = q.filter(NotificationLog.farmer_id == g.current_farmer_id)
        rows = q.order_by(NotificationLog.created_at.desc()).limit(50).all()
        return jsonify({"notifications": [r.to_dict() for r in rows]}), 200


@api_v1.route("/reports/credential-card/<farmer_id>", methods=["GET"])
@require_auth()
def download_single_credential_card(farmer_id: str):
    check_object_ownership(farmer_id)
    _, _, card_service, _ = _get_services()
    temp_pwd = request.args.get("otp")
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Farmer not found.", 404)
        farmer_dict = _serialize_farmer(farmer, include_parcels=False)

    pdf_bytes = card_service.generate_single_card_pdf(
        farmer=farmer_dict,
        One_time_password=temp_pwd,
        base_url=request.host_url.rstrip("/"),
    )
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"Kshetra_Card_{farmer_id}.pdf",
    )


@api_v1.route("/reports/credential-cards/batch", methods=["POST"])
@require_auth(role="admin")
def download_batch_credential_cards():
    _, _, card_service, _ = _get_services()
    body = request.get_json(silent=True) or {}
    requested_ids = body.get("farmer_ids") or []
    passwords_map = body.get("passwords") or {}

    with db_manager.session_scope() as session:
        if requested_ids:
            farmers = (
                session.query(Farmer)
                .filter(Farmer.farmer_id.in_(requested_ids), Farmer.deleted_at.is_(None))
                .all()
            )
        else:
            farmers = FarmerRepository.list_active_farmers(session)
        pairs = [
            (_serialize_farmer(f, include_parcels=False), passwords_map.get(f.farmer_id))
            for f in farmers
        ]

    pdf_bytes = card_service.generate_batch_sheet_pdf(
        farmers_with_passwords=pairs,
        base_url=request.host_url.rstrip("/"),
    )
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="Kshetra_Batch_Credential_Cards.pdf",
    )


# ============================================================================
# ADMIN CONSOLE (PHASE 5.1: 40-FARMER CAP, VERIFY LAND, AUDIT LOG, CSV EXPORT)
# ============================================================================


@api_v1.route("/admin/overview", methods=["GET"])
@require_auth(role="admin")
def admin_overview():
    max_farmers = int(current_app.config.get("MAX_FARMERS", 40))
    with db_manager.session_scope() as session:
        farmers = FarmerRepository.list_active_farmers(session)
        farmer_list = [_serialize_farmer(f, include_parcels=True) for f in farmers]
        sources = TelemetryRepository.list_source_health(session)
        audits = (
            session.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(50).all()
        )
        feedbacks = (
            session.query(FeedbackEntry)
            .order_by(FeedbackEntry.created_at.desc())
            .limit(50)
            .all()
        )
        notifications = (
            session.query(NotificationLog)
            .order_by(NotificationLog.created_at.desc())
            .limit(30)
            .all()
        )

    return (
        jsonify(
            {
                "capacity": {
                    "active_farmers": len(farmer_list),
                    "max_farmers": max_farmers,
                    "remaining_slots": max(0, max_farmers - len(farmer_list)),
                },
                "farmers": farmer_list,
                "source_health": sources,
                "audit_logs": [a.to_dict() for a in audits],
                "feedback": [fb.to_dict() for fb in feedbacks],
                "notifications": [n.to_dict() for n in notifications],
            }
        ),
        200,
    )


@api_v1.route("/admin/farmers", methods=["GET", "POST"])
@require_auth(role="admin")
def admin_farmers():
    max_farmers = int(current_app.config.get("MAX_FARMERS", 40))
    if request.method == "GET":
        with db_manager.session_scope() as session:
            farmers = FarmerRepository.list_active_farmers(session)
            items = [_serialize_farmer(f, include_parcels=True) for f in farmers]
        return (
            jsonify(
                {
                    "active_count": len(items),
                    "max_farmers": max_farmers,
                    "farmers": items,
                }
            ),
            200,
        )

    payload = validate_create_farmer_payload(request.get_json(silent=True))
    cleartext_password = generate_natural_password()
    password_hash = hash_password(cleartext_password)
    mobile_enc = (
        encrypt_field(payload["mobile"], current_app.config["SECRET_KEY"])
        if payload["mobile"]
        else None
    )

    # Generate collision-free Farmer ID
    farmer_id = generate_farmer_id()
    created_farmer = FarmerRepository.create_farmer_atomic(
        db_manager,
        farmer_id=farmer_id,
        name=payload["name"] or "",
        password_hash=password_hash,
        district=payload["district"] or "Ahilya Nagar",
        taluka=payload["taluka"] or "",
        village=payload["village"] or "",
        preferred_language=payload["preferred_language"] or "mr",
        mobile_encrypted=mobile_enc,
        holder_relation=payload.get("holder_relation"),
        farmer_category=payload.get("farmer_category") or "small",
        primary_crops=payload.get("primary_crops"),
        farming_experience_years=payload.get("farming_experience_years"),
        bio_note=payload.get("bio_note"),
        actor_id=g.current_farmer_id,
        ip_address=request.remote_addr,
        max_farmers=max_farmers,
    )
    return (
        jsonify(
            {
                "farmer": created_farmer,
                "temporary_password": cleartext_password,
                "card_pdf_url": f"/api/v1/reports/credential-card/{farmer_id}",
            }
        ),
        201,
    )


@api_v1.route("/admin/farmers/<farmer_id>/reset-password", methods=["POST"])
@require_auth(role="admin")
def admin_reset_farmer_password(farmer_id: str):
    new_password = generate_natural_password()
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Farmer not found.", 404)
        farmer.password_hash = hash_password(new_password)
        farmer.must_change_password = True
        farmer.failed_attempts = 0
        farmer.locked_until = None
        FarmerRepository.revoke_all_refresh_tokens(session, farmer_id)
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="ADMIN_RESET_PASSWORD",
            target_id=farmer_id,
            ip_address=request.remote_addr,
        )
        session.commit()
        profile = _serialize_farmer(farmer, include_parcels=True)
    return jsonify({"farmer": profile, "temporary_password": new_password}), 200


@api_v1.route("/admin/farmers/<farmer_id>/unlock", methods=["POST"])
@require_auth(role="admin")
def admin_unlock_farmer(farmer_id: str):
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Farmer not found.", 404)
        farmer.failed_attempts = 0
        farmer.locked_until = None
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="ADMIN_UNLOCK_ACCOUNT",
            target_id=farmer_id,
            ip_address=request.remote_addr,
        )
        session.commit()
        return jsonify({"farmer": _serialize_farmer(farmer, include_parcels=True)}), 200


@api_v1.route("/admin/farmers/<farmer_id>/lock", methods=["POST"])
@require_auth(role="admin")
def admin_lock_farmer(farmer_id: str):
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Farmer not found.", 404)
        farmer.locked_until = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=365)
        FarmerRepository.revoke_all_refresh_tokens(session, farmer_id)
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="ADMIN_LOCK_ACCOUNT",
            target_id=farmer_id,
            ip_address=request.remote_addr,
        )
        session.commit()
        return jsonify({"farmer": _serialize_farmer(farmer, include_parcels=True)}), 200


@api_v1.route("/admin/farmers/<farmer_id>", methods=["PATCH"])
@require_auth(role="admin")
def admin_update_farmer(farmer_id: str):
    """Update a registered farmer's natural profile attributes from the officer portal."""
    updates = validate_update_farmer_payload(request.get_json(silent=True))
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Farmer not found.", 404)
        for field in (
            "name",
            "district",
            "taluka",
            "village",
            "preferred_language",
            "holder_relation",
            "farmer_category",
            "primary_crops",
            "farming_experience_years",
            "bio_note",
        ):
            if field in updates:
                setattr(farmer, field, updates[field])
        if "mobile" in updates:
            mobile_val = updates["mobile"]
            farmer.mobile_encrypted = (
                encrypt_field(mobile_val, current_app.config["SECRET_KEY"]) if mobile_val else None
            )
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="ADMIN_UPDATE_FARMER",
            target_id=farmer_id,
            ip_address=request.remote_addr,
        )
        session.commit()
        session.refresh(farmer)
        profile = _serialize_farmer(farmer, include_parcels=True)
    return jsonify({"farmer": profile}), 200


@api_v1.route("/admin/farmers/<farmer_id>", methods=["DELETE"])
@require_auth(role="admin")
def admin_delete_farmer(farmer_id: str):
    with db_manager.session_scope() as session:
        farmer = FarmerRepository.get_by_farmer_id(session, farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Farmer not found.", 404)
        if farmer.role == "admin":
            raise AppError("CANNOT_DELETE_ADMIN", "Cannot delete an administrator account.", 400)
        FarmerRepository.delete_farmer_and_data(
            session, farmer, actor_id=g.current_farmer_id, ip_address=request.remote_addr
        )
    return jsonify({"status": "deleted", "farmer_id": farmer_id}), 200


@api_v1.route("/admin/parcels/<int:parcel_id>/verify", methods=["POST"])
@require_auth(role="admin")
def admin_verify_parcel(parcel_id: int):
    body = request.get_json(silent=True) or {}
    verified = bool(body.get("land_verified", True))
    with db_manager.session_scope() as session:
        parcel = session.query(Parcel).filter(Parcel.id == parcel_id).first()
        if not parcel:
            raise AppError("PARCEL_NOT_FOUND", "Parcel not found.", 404)
        parcel.land_verified = verified
        parcel.verified_by = g.current_farmer_id if verified else None
        parcel.verified_at = (
            datetime.now(timezone.utc).replace(tzinfo=None) if verified else None
        )
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="VERIFY_PARCEL_LAND" if verified else "UNVERIFY_PARCEL_LAND",
            target_id=f"parcel:{parcel_id}",
            details={"farmer_id": parcel.farmer_id, "land_verified": verified},
            ip_address=request.remote_addr,
        )
        session.commit()
        return jsonify({"parcel": _serialize_parcel(parcel)}), 200


@api_v1.route("/admin/export/farmers.csv", methods=["GET"])
@require_auth(role="admin")
def admin_export_farmers_csv():
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "farmer_id",
            "name",
            "district",
            "taluka",
            "village",
            "preferred_language",
            "parcel_count",
            "total_area_acres",
            "verified_parcels",
            "created_at",
            "last_login",
        ]
    )
    with db_manager.session_scope() as session:
        farmers = FarmerRepository.list_active_farmers(session)
        for f in farmers:
            total_acres = round(sum(p.area_acres for p in f.parcels), 2)
            verified_cnt = sum(1 for p in f.parcels if p.land_verified)
            writer.writerow(
                [
                    f.farmer_id,
                    f.name,
                    f.district,
                    f.taluka,
                    f.village,
                    f.preferred_language,
                    len(f.parcels),
                    total_acres,
                    verified_cnt,
                    f.created_at.isoformat() + "Z" if f.created_at else "",
                    f.last_login.isoformat() + "Z" if f.last_login else "",
                ]
            )
        CommunityRepository.log_audit(
            session,
            actor_id=g.current_farmer_id,
            action="EXPORT_FARMERS_CSV",
            ip_address=request.remote_addr,
        )

    csv_bytes = buf.getvalue().encode("utf-8-sig")
    return Response(
        csv_bytes,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=kshetra_farmers_report.csv"},
    )


# ============================================================================
# META, VERSION, PUBLIC STATUS & OPENAPI SPEC
# ============================================================================


@api_v1.route("/meta/version", methods=["GET"])
def meta_version():
    return (
        jsonify(
            {
                "name": "Kshetra (formerly TERRAWISE AI)",
                "version": current_app.config.get("APP_VERSION", "2.0.0"),
                "commit": current_app.config.get("GIT_COMMIT_SHA", "HEAD"),
                "environment": current_app.config.get("APP_ENV", "development"),
                "supported_districts": ["Ahilya Nagar", "Nashik"],
                "max_farmers": int(current_app.config.get("MAX_FARMERS", 40)),
            }
        ),
        200,
    )


@api_v1.route("/meta/status", methods=["GET"])
def meta_public_status():
    """Public /status endpoint showing real database connectivity and upstream source health."""
    db_ok = db_manager.ping()
    with db_manager.session_scope() as session:
        sources = TelemetryRepository.list_source_health(session)
        active_farmers = FarmerRepository.count_active_farmers(session)
    return (
        jsonify(
            {
                "status": "operational" if db_ok else "degraded",
                "checked_at": datetime.now(timezone.utc).isoformat(),
                "database": "connected" if db_ok else "unreachable",
                "capacity": {
                    "active_farmers": active_farmers,
                    "max_farmers": int(current_app.config.get("MAX_FARMERS", 40)),
                },
                "upstream_sources": sources,
            }
        ),
        200 if db_ok else 503,
    )


@api_v1.route("/openapi.json", methods=["GET"])
def get_openapi_spec():
    spec_path = current_app.config["BASE_DIR"] / "docs" / "openapi.json"
    if spec_path.exists():
        return Response(spec_path.read_bytes(), mimetype="application/json")
    return jsonify({"openapi": "3.1.0", "info": {"title": "Kshetra API", "version": "2.0.0"}}), 200


def _detect_lan_ipv4_addresses() -> List[str]:
    """Enumerate active local non-loopback IPv4 addresses safely without sending packets."""
    ips: List[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            primary_ip = s.getsockname()[0]
            if primary_ip and not primary_ip.startswith("127."):
                ips.append(primary_ip)
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = str(info[4][0])
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips


def _collect_access_metadata() -> Dict[str, Any]:
    """Assemble verified local, LAN, public URL, and PWA bundle readiness metadata."""
    base_dir = Path(current_app.config["BASE_DIR"])
    dist_dir = base_dir / "frontend" / "dist"
    public_dir = base_dir / "frontend" / "public"

    current_origin = request.host_url.rstrip("/")
    parsed_port = request.host.split(":")[1] if ":" in request.host else ""
    lan_ips = _detect_lan_ipv4_addresses()
    scheme = request.scheme or "http"

    lan_urls: List[str] = []
    for ip in lan_ips:
        port_suffix = f":{parsed_port}" if parsed_port else ""
        lan_urls.append(f"{scheme}://{ip}{port_suffix}")

    public_url = str(current_app.config.get("PUBLIC_URL") or "").strip().rstrip("/")
    recommended_url = public_url or (lan_urls[0] if lan_urls else current_origin)

    # Also allow matching Vite dev origins on loopback/LAN when in non-production
    dev_origins: List[str] = []
    if current_app.config.get("ALLOW_LAN_ORIGINS"):
        dev_origins.extend(["http://127.0.0.1:5173", "http://localhost:5173"])
        dev_origins.extend(f"http://{ip}:5173" for ip in lan_ips)

    allowed_urls = list(dict.fromkeys(u for u in [public_url, *lan_urls, current_origin, *dev_origins] if u))

    manifest_ready = (dist_dir / "manifest.webmanifest").is_file() or (
        public_dir / "manifest.webmanifest"
    ).is_file()
    dist_ready = (dist_dir / "index.html").is_file()
    windows_exe_ready = (base_dir / "release" / "Kshetra-Desktop.exe").is_file()
    android_project_ready = (base_dir / "mobile" / "capacitor.config.json").is_file() and (
        base_dir / "mobile" / "build_apk.ps1"
    ).is_file()

    return {
        "current_origin": current_origin,
        "public_url": public_url or None,
        "lan_ips": lan_ips,
        "lan_urls": lan_urls,
        "recommended_share_url": recommended_url,
        "allowed_urls": allowed_urls,
        "pwa_manifest_ready": manifest_ready,
        "production_bundle_built": dist_ready,
        "windows_exe_ready": windows_exe_ready,
        "android_project_ready": android_project_ready,
    }


def _resolve_verified_access_url(requested_url: Optional[str]) -> str:
    """Restrict QR / launcher URL targets strictly to server-verified local, LAN, or configured public URLs."""
    meta = _collect_access_metadata()
    if not requested_url:
        return str(meta["recommended_share_url"])
    clean_req = requested_url.strip().rstrip("/")
    if clean_req in meta["allowed_urls"]:
        return clean_req
    raise AppError(
        "UNTRUSTED_TARGET_URL",
        "Requested share URL must match this server's verified origin, LAN IP, or configured KSHETRA_PUBLIC_URL.",
        400,
    )


@api_v1.route("/meta/access-info", methods=["GET"])
def meta_access_info():
    """Return local/LAN/public URLs and PWA/Desktop/Mobile packaging readiness metadata."""
    meta = _collect_access_metadata()
    return jsonify(
        {
            "current_origin": meta["current_origin"],
            "public_url": meta["public_url"],
            "lan_urls": meta["lan_urls"],
            "recommended_share_url": meta["recommended_share_url"],
            "pwa_manifest_ready": meta["pwa_manifest_ready"],
            "production_bundle_built": meta["production_bundle_built"],
            "windows_exe_ready": meta["windows_exe_ready"],
            "android_project_ready": meta["android_project_ready"],
            "android_package_id": "in.kshetra.agri",
            "tunnel_command_hint": "cloudflared tunnel --url http://127.0.0.1:5000",
        }
    ), 200


@api_v1.route("/meta/access-qr", methods=["GET"])
def meta_access_qr():
    """Generate a local SVG QR code for phone/tablet access (allowlisted origins only)."""
    target_url = _resolve_verified_access_url(request.args.get("target"))
    img = qrcode.make(target_url, image_factory=qrcode.image.svg.SvgPathImage, box_size=12, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return Response(
        buf.getvalue(),
        mimetype="image/svg+xml",
        headers={"Cache-Control": "no-store"},
    )


@api_v1.route("/meta/download/windows-launcher", methods=["GET"])
def meta_download_windows_launcher():
    """Serve a standalone Windows desktop app launcher targeting Edge/Chrome app mode."""
    target_url = _resolve_verified_access_url(request.args.get("target"))
    bat_lines = [
        "@echo off",
        "title Kshetra - Digital Krishi Kendra",
        f'set "KSHETRA_URL={target_url}"',
        'set "EDGE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
        'set "EDGE64=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
        'set "CHROME=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"',
        'set "CHROME86=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"',
        'if exist "%EDGE%" ( start "" "%EDGE%" --app=%KSHETRA_URL% & exit /b 0 )',
        'if exist "%EDGE64%" ( start "" "%EDGE64%" --app=%KSHETRA_URL% & exit /b 0 )',
        'if exist "%CHROME%" ( start "" "%CHROME%" --app=%KSHETRA_URL% & exit /b 0 )',
        'if exist "%CHROME86%" ( start "" "%CHROME86%" --app=%KSHETRA_URL% & exit /b 0 )',
        'start "" "%KSHETRA_URL%"',
        "",
    ]
    return Response(
        "\r\n".join(bat_lines).encode("utf-8"),
        mimetype="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="Kshetra-App.bat"',
            "Cache-Control": "no-store",
        },
    )


@api_v1.route("/meta/download/windows-exe", methods=["GET"])
def meta_download_windows_exe():
    """Serve Kshetra-Desktop.exe, optionally embedding a verified ?target= server URL in its PE overlay."""
    base_dir = Path(current_app.config["BASE_DIR"])
    exe_path = base_dir / "release" / "Kshetra-Desktop.exe"
    if not exe_path.is_file():
        raise AppError(
            "EXE_NOT_BUILT",
            "Kshetra-Desktop.exe has not been compiled yet. Run python packaging/windows/build_exe.py.",
            404,
        )
    payload = exe_path.read_bytes()
    requested_target = request.args.get("target")
    if requested_target:
        verified_url = _resolve_verified_access_url(requested_target)
        cfg_blob = json.dumps({"url": verified_url}, separators=(",", ":")).encode("utf-8")
        payload = payload + b"\n__KSHETRA_CFG__=" + cfg_blob + b"\n"

    return Response(
        payload,
        mimetype="application/vnd.microsoft.portable-executable",
        headers={
            "Content-Disposition": 'attachment; filename="Kshetra-Desktop.exe"',
            "Cache-Control": "no-store",
        },
    )
