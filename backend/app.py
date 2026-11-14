"""
TERRAWISE AI - Main Flask REST API Backend
Fully integrated with SQLite DB, GIS Validator, Data Pipeline, Advice Engine, and Credential Cards.
"""

import os
import json
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS

from models import Base, Farmer, Parcel, CropHistory, WeatherSnapshot, AuditLog
from database import engine, SessionLocal, init_db, create_farmer_atomic, MAX_FARMERS_CAP
from utils import hash_password, verify_password, safe_value, generate_natural_password
from geo_validator import validate_and_process_polygon, check_parcel_overlap
from data_pipeline import fetch_open_meteo, fetch_nasa_power_history, get_data_health_summary
from advice_engine import generate_parcel_advice, load_crops_db, get_current_season
from credential_cards import build_single_card_a6, build_batch_cards_a4

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
GEO_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "data", "geo"))
DOCS_RESEARCH_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "docs", "research"))

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "terrawise_secret_pilot_ahilyanagar_nashik_2026")
CORS(app, supports_credentials=True, origins=["*"])

# Simple token storage for pilot session auth
ACTIVE_SESSIONS = {}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def require_auth(roles=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            token = None
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            elif "session_token" in request.cookies:
                token = request.cookies.get("session_token")

            if not token or token not in ACTIVE_SESSIONS:
                return jsonify({"error": "UNAUTHORIZED", "message": "कृपया प्रथम लॉगिन करा (Please log in first)"}), 401

            session_data = ACTIVE_SESSIONS[token]
            farmer_id = session_data["farmer_id"]

            db = SessionLocal()
            farmer = db.query(Farmer).filter_by(farmer_id=farmer_id).first()
            if not farmer or farmer.is_locked:
                db.close()
                return jsonify({"error": "ACCOUNT_LOCKED", "message": "खाते लॉक झाले आहे (Account locked or invalid)"}), 403

            if roles and farmer.role not in roles:
                db.close()
                return jsonify({"error": "FORBIDDEN", "message": "या पानासाठी अधिकार नाहीत (Access restricted)"}), 403

            request.current_farmer = farmer
            request.db = db
            try:
                return f(*args, **kwargs)
            finally:
                db.close()
        return decorated
    return decorator

# Initialize database
init_db()

@app.route("/api/health", methods=["GET"])
def health_check():
    db = SessionLocal()
    farmer_count = db.query(Farmer).filter(Farmer.role == "farmer").count()
    parcel_count = db.query(Parcel).count()
    db.close()
    return jsonify({
        "status": "healthy",
        "service": "TERRAWISE AI Pilot Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pilot_districts": ["Ahilya Nagar (Ahmednagar)", "Nashik"],
        "max_farmers_cap": MAX_FARMERS_CAP,
        "registered_farmers": farmer_count,
        "total_parcels": parcel_count
    })

@app.route("/api/public/district-summary", methods=["GET"])
def public_district_summary():
    """Public endpoint for landing page live district chips (Ahilya Nagar & Nashik)."""
    # Fetch for Nashik (20.00, 73.79) and Ahilya Nagar (19.10, 74.74)
    nsk_weather = fetch_open_meteo(lat=20.00, lon=73.79)
    ahn_weather = fetch_open_meteo(lat=19.10, lon=74.74)

    def extract_chip(w_data, name_mr, name_en):
        curr = w_data.get("current", {})
        temp = curr.get("temperature", {}).get("value")
        rain = curr.get("precipitation_now_mm", {}).get("value", 0)
        forecast_today = w_data.get("forecast", [{}])[0] if w_data.get("forecast") else {}
        rain_prob = forecast_today.get("rain_prob_pct", {}).get("value", 0)
        obs_time = w_data.get("observed_at_str", "आताच")

        # Condition logic based on real rain and temp
        if rain and rain > 0.5:
            cond_mr, cond_hi, cond_en = "पाऊस", "बारिश", "Rain"
            icon = "rain"
        elif rain_prob and rain_prob > 40:
            cond_mr, cond_hi, cond_en = "संभाव्य पाऊस", "संभावित वर्षा", "Rain Chance"
            icon = "rain-chance"
        elif temp and temp < 16:
            cond_mr, cond_hi, cond_en = "थंड", "शीतल", "Cool"
            icon = "cool"
        elif temp and temp > 33:
            cond_mr, cond_hi, cond_en = "उष्ण", "गर्म", "Hot"
            icon = "hot"
        else:
            cond_mr, cond_hi, cond_en = "स्वच्छ", "साफ", "Clear"
            icon = "sun"

        return {
            "district_mr": name_mr,
            "district_en": name_en,
            "temperature_c": temp,
            "rain_probability_pct": rain_prob,
            "condition": {"mr": cond_mr, "hi": cond_hi, "en": cond_en},
            "condition_icon": icon,
            "observed_at": obs_time,
            "source": "Open-Meteo"
        }

    return jsonify({
        "success": True,
        "districts": [
            extract_chip(nsk_weather, "नाशिक", "Nashik"),
            extract_chip(ahn_weather, "अहिल्या नगर", "Ahilya Nagar")
        ]
    })

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True, silent=True) or {}
    raw_id = str(data.get("farmer_id", "")).strip().upper()
    password = str(data.get("password", "")).strip()

    # Normalize ID: if user types "NSK001" or "nsk-1", normalize
    clean_id = raw_id
    if not "-" in clean_id and len(clean_id) >= 4:
        clean_id = f"{clean_id[:3]}-{clean_id[3:]}"

    db = SessionLocal()
    farmer = db.query(Farmer).filter_by(farmer_id=clean_id).first()

    if not farmer:
        # Check by mobile if provided
        if raw_id.isdigit():
            farmer = db.query(Farmer).filter_by(mobile=raw_id).first()

    if not farmer:
        db.close()
        return jsonify({"error": "INVALID_CREDENTIALS", "message": "चुकीचा शेतकरी आयडी किंवा पासवर्ड (Invalid ID or password)"}), 401

    if farmer.is_locked:
        db.close()
        return jsonify({
            "error": "ACCOUNT_LOCKED",
            "message": "वारंवार चुकीचा पासवर्ड टाकल्याने खाते लॉक झाले आहे. कृषी अधिकाऱ्यांशी संपर्क साधा (Account locked after 5 failed attempts. Contact Field Officer)."
        }), 403

    # Check password
    if not verify_password(farmer.password_hash, password):
        farmer.failed_login_attempts += 1
        if farmer.failed_login_attempts >= 5:
            farmer.is_locked = True
            db.commit()
            db.close()
            return jsonify({
                "error": "ACCOUNT_LOCKED",
                "message": "५ वेळा चुकीचा पासवर्ड टाकल्याने खाते लॉक झाले आहे (Account locked after 5 failed attempts)."
            }), 403
        db.commit()
        attempts_left = 5 - farmer.failed_login_attempts
        db.close()
        return jsonify({
            "error": "INVALID_PASSWORD",
            "message": f"चुकीचा पासवर्ड. उर्वरित प्रयत्न: {attempts_left} (Wrong password. {attempts_left} attempts left)."
        }), 401

    # Reset failed attempts
    farmer.failed_login_attempts = 0
    token = secrets.token_hex(24)
    ACTIVE_SESSIONS[token] = {
        "farmer_id": farmer.farmer_id,
        "role": farmer.role,
        "login_at": datetime.now(timezone.utc).isoformat()
    }

    resp_data = {
        "success": True,
        "token": token,
        "farmer": farmer.to_dict(include_private=True)
    }
    db.commit()
    db.close()

    resp = make_response(jsonify(resp_data))
    resp.set_cookie("session_token", token, httponly=True, samesite="Lax")
    return resp

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    elif "session_token" in request.cookies:
        token = request.cookies.get("session_token")

    if token in ACTIVE_SESSIONS:
        del ACTIVE_SESSIONS[token]

    resp = make_response(jsonify({"success": True}))
    resp.set_cookie("session_token", "", expires=0)
    return resp

@app.route("/api/auth/change-password", methods=["POST"])
@require_auth()
def change_password():
    data = request.get_json(force=True, silent=True) or {}
    new_password = data.get("new_password", "").strip()

    if len(new_password) < 8:
        return jsonify({"error": "WEAK_PASSWORD", "message": "नवीन पासवर्ड किमान ८ अक्षरांचा हवा (Password must be at least 8 characters)"}), 400

    db = request.db
    farmer = request.current_farmer
    farmer.password_hash = hash_password(new_password)
    farmer.must_change_password = False
    db.commit()

    return jsonify({"success": True, "message": "पासवर्ड यशस्वीरीत्या बदलला (Password updated successfully)"})

@app.route("/api/farmer/me", methods=["GET"])
@require_auth()
def get_farmer_profile():
    return jsonify({
        "success": True,
        "farmer": request.current_farmer.to_dict(include_private=True)
    })

@app.route("/api/farmer/parcels", methods=["GET"])
@require_auth()
def get_farmer_parcels():
    db = request.db
    farmer_id = request.current_farmer.farmer_id
    parcels = db.query(Parcel).filter_by(farmer_ref=farmer_id).all()
    return jsonify({
        "success": True,
        "parcels": [p.to_dict() for p in parcels]
    })

@app.route("/api/farmer/parcels", methods=["POST"])
@require_auth()
def add_farmer_parcel():
    db = request.db
    farmer = request.current_farmer
    data = request.get_json(force=True, silent=True) or {}

    # Check parcel count cap (max 4 per farmer)
    existing_parcels = db.query(Parcel).filter_by(farmer_ref=farmer.farmer_id).all()
    if len(existing_parcels) >= 4:
        return jsonify({"error": "PARCEL_LIMIT_REACHED", "message": "एका शेतकऱ्याला जास्तीत जास्त ४ शेत तुकडे जोडता येतात (Max 4 parcels per farmer)"}), 400

    raw_geom = data.get("geometry")
    if not raw_geom:
        return jsonify({"error": "MISSING_GEOMETRY", "message": "कृपया शेताची सीमा नकाशावर आखा (Please provide field boundary geometry)"}), 400

    # Validate with Shapely + Pyproj
    val = validate_and_process_polygon(raw_geom, district=farmer.district)
    if not val["valid"]:
        return jsonify({"error": "GEOMETRY_INVALID", "message": val["error"]}), 400

    # Check parcel overlap with other parcels in system
    all_other_parcels = db.query(Parcel).filter(Parcel.farmer_ref != farmer.farmer_id).all()
    other_geoms = [json.loads(p.geojson_str) for p in all_other_parcels if p.geojson_str]
    has_overlap, overlap_err = check_parcel_overlap(val["clean_geometry"], other_geoms)
    if has_overlap:
        return jsonify({
            "error": "PARCEL_OVERLAP_CONFLICT",
            "message": f"शेताची सीमा दुसऱ्या शेतकऱ्याच्या जमिनीवर ओव्हरलॅप होते: {overlap_err}. कृषी अधिकाऱ्यांशी संपर्क साधा."
        }), 409

    next_num = len(existing_parcels) + 1
    new_parcel = Parcel(
        farmer_ref=farmer.farmer_id,
        parcel_number=next_num,
        geojson_str=json.dumps(val["clean_geometry"]),
        centroid_lat=val["centroid"]["lat"],
        centroid_lon=val["centroid"]["lon"],
        area_sqm=val["area_sqm"],
        area_ha=val["area_ha"],
        area_acre=val["area_acre"],
        area_guntha=val["area_guntha"],
        boundary_source=data.get("boundary_source", "farmer_drawn"),
        accuracy_m=float(data.get("accuracy_m", 1.5)),
        verified_by_officer=False,
        district=farmer.district,
        taluka=farmer.taluka,
        village=farmer.village,
        survey_number=data.get("survey_number")
    )
    db.add(new_parcel)
    db.commit()

    return jsonify({
        "success": True,
        "parcel": new_parcel.to_dict(),
        "message": f"शेत तुकडा #{next_num} यशस्वीरीत्या जोडला ({val['area_acre']} एकर / {val['area_guntha']} गुंठे)"
    }), 201

@app.route("/api/farmer/dashboard", methods=["GET"])
@require_auth()
def get_farmer_dashboard():
    db = request.db
    farmer = request.current_farmer
    parcels = db.query(Parcel).filter_by(farmer_ref=farmer.farmer_id).all()

    # If farmer has at least one parcel, use centroid of first parcel; else use taluka default center
    if parcels and parcels[0].centroid_lat:
        lat = parcels[0].centroid_lat
        lon = parcels[0].centroid_lon
        active_parcel = parcels[0].to_dict()
    else:
        # Default district centers
        if "ahilya" in farmer.district.lower() or "ahmed" in farmer.district.lower():
            lat, lon = 19.382, 74.652 # Rahuri
        else:
            lat, lon = 20.145, 74.225 # Niphad
        active_parcel = None

    # Fetch real live weather from Open-Meteo
    weather_data = fetch_open_meteo(lat, lon)

    # Generate Advice from advice engine
    advice = generate_parcel_advice(
        district=farmer.district,
        taluka=farmer.taluka,
        soil_type=farmer.soil_type,
        irrigation_source=farmer.irrigation_source,
        current_weather=weather_data,
        priority=request.args.get("priority", "balanced")
    )

    # Simplified Today card summary per Grade-4 UX rules
    today_summary = {
        "greeting_mr": f"नमस्कार, {farmer.full_name}!",
        "greeting_en": f"Welcome, {farmer.full_name}!",
        "farmer_id": farmer.farmer_id,
        "is_demo": farmer.is_demo,
        "active_parcel": active_parcel,
        "traffic_light": advice["diagnostics"]["soil_water"]["level"],
        "one_sentence_mr": advice["diagnostics"]["soil_water"]["text_mr"],
        "one_sentence_en": advice["diagnostics"]["soil_water"]["label_en"],
        "one_action_mr": advice["diagnostics"]["pest_risk"]["action_mr"],
        "one_action_en": advice["diagnostics"]["pest_risk"]["action_en"]
    }

    return jsonify({
        "success": True,
        "today_card": today_summary,
        "weather": weather_data,
        "advice": advice,
        "parcels": [p.to_dict() for p in parcels]
    })

# --- Admin Endpoints ---

@app.route("/api/admin/farmers", methods=["GET"])
@require_auth(roles=["admin"])
def list_farmers():
    db = request.db
    farmers = db.query(Farmer).filter(Farmer.role == "farmer").order_by(Farmer.id.asc()).all()
    total_count = len(farmers)
    return jsonify({
        "success": True,
        "count_label": f"{total_count} of {MAX_FARMERS_CAP} farmers registered",
        "total_count": total_count,
        "max_allowed": MAX_FARMERS_CAP,
        "farmers": [f.to_dict(include_private=True) for f in farmers]
    })

@app.route("/api/admin/farmers", methods=["POST"])
@require_auth(roles=["admin"])
def admin_create_farmer():
    data = request.get_json(force=True, silent=True) or {}
    full_name = data.get("full_name", "").strip()
    village = data.get("village", "").strip()
    taluka = data.get("taluka", "").strip()
    district = data.get("district", "Ahilya Nagar").strip()

    if not full_name or not village or not taluka or not district:
        return jsonify({"error": "MISSING_FIELDS", "message": "सर्व माहिती आवश्यक आहे (All fields required)"}), 400

    success, res_data, code = create_farmer_atomic(
        full_name=full_name,
        village=village,
        taluka=taluka,
        district=district,
        language=data.get("language", "mr"),
        mobile=data.get("mobile"),
        soil_type=data.get("soil_type", "Medium Black Soil"),
        irrigation_source=data.get("irrigation_source", "Well Irrigation"),
        actor_id=request.current_farmer.farmer_id
    )

    return jsonify(res_data), code

@app.route("/api/admin/farmers/<f_id>/reset-password", methods=["POST"])
@require_auth(roles=["admin"])
def admin_reset_password(f_id):
    db = request.db
    farmer = db.query(Farmer).filter_by(farmer_id=f_id).first()
    if not farmer:
        return jsonify({"error": "NOT_FOUND", "message": "शेतकरी सापडला नाही"}), 404

    # Generate new natural password
    new_pass = generate_natural_password()
    farmer.password_hash = hash_password(new_pass)
    farmer.failed_login_attempts = 0
    farmer.is_locked = False
    farmer.must_change_password = True

    # Audit log
    audit = AuditLog(
        action="RESET_PASSWORD",
        actor_farmer_id=request.current_farmer.farmer_id,
        target_farmer_id=f_id,
        details=f"Admin reset password for {f_id}"
    )
    db.add(audit)
    db.commit()

    return jsonify({
        "success": True,
        "farmer_id": f_id,
        "one_time_password": new_pass, # In memory only
        "message": f"शेतकरी {f_id} चा पासवर्ड रिसेट केला आहे."
    })

@app.route("/api/admin/farmers/<f_id>/unlock", methods=["POST"])
@require_auth(roles=["admin"])
def admin_unlock_farmer(f_id):
    db = request.db
    farmer = db.query(Farmer).filter_by(farmer_id=f_id).first()
    if not farmer:
        return jsonify({"error": "NOT_FOUND"}), 404

    farmer.is_locked = False
    farmer.failed_login_attempts = 0
    db.commit()

    return jsonify({"success": True, "message": f"शेतकरी {f_id} चे खाते अनलॉक केले आहे."})

@app.route("/api/admin/credential-card/<f_id>", methods=["GET"])
@require_auth(roles=["admin"])
def get_farmer_credential_card(f_id):
    db = request.db
    farmer = db.query(Farmer).filter_by(farmer_id=f_id).first()
    if not farmer:
        return jsonify({"error": "NOT_FOUND"}), 404

    tmp_pdf = os.path.join(DATA_DIR, f"card_{f_id}.pdf")
    f_data = {
        "farmer_id": farmer.farmer_id,
        "full_name": farmer.full_name,
        "village": farmer.village,
        "taluka": farmer.taluka,
        "district": farmer.district,
        "one_time_password": "Protected (Ask Officer)"
    }
    build_single_card_a6(f_data, tmp_pdf)
    return send_file(tmp_pdf, mimetype="application/pdf", as_attachment=False, download_name=f"Credential_{f_id}.pdf")

@app.route("/api/admin/credential-cards-batch", methods=["GET"])
@require_auth(roles=["admin"])
def get_batch_credential_cards():
    db = request.db
    farmers = db.query(Farmer).filter(Farmer.role == "farmer").order_by(Farmer.id.asc()).all()
    batch_data = []
    for f in farmers:
        batch_data.append({
            "farmer_id": f.farmer_id,
            "full_name": f.full_name,
            "village": f.village,
            "taluka": f.taluka,
            "district": f.district,
            "one_time_password": "Protected (Ask Officer)"
        })

    tmp_batch = os.path.join(DATA_DIR, "all_farmers_batch_a4.pdf")
    build_batch_cards_a4(batch_data, tmp_batch)
    return send_file(tmp_batch, mimetype="application/pdf", as_attachment=False, download_name="All_Farmers_Cards_A4.pdf")

@app.route("/api/admin/data-health", methods=["GET"])
@require_auth(roles=["admin"])
def data_health():
    return jsonify({
        "success": True,
        "summary": get_data_health_summary(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

# --- Static GeoJSON / Resource Endpoints ---

@app.route("/api/geo/districts", methods=["GET"])
def get_districts_geojson():
    path = os.path.join(GEO_DIR, "districts_display.geojson")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"type": "FeatureCollection", "features": []})

@app.route("/api/geo/talukas", methods=["GET"])
def get_talukas_geojson():
    path = os.path.join(GEO_DIR, "talukas_display.geojson")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"type": "FeatureCollection", "features": []})

@app.route("/api/geo/crops", methods=["GET"])
def get_crops_list():
    return jsonify(load_crops_db())

@app.route("/api/geo/glossary", methods=["GET"])
def get_glossary_list():
    path = os.path.join(DOCS_RESEARCH_DIR, "glossary.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify([])

# --- Frontend Static Serving (Single-Port Mode) ---
FRONTEND_DIST = os.path.normpath(os.path.join(BASE_DIR, "..", "frontend", "dist"))

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "NOT_FOUND", "message": f"API endpoint /{path} not found"}), 404
    if path and os.path.exists(os.path.join(FRONTEND_DIST, path)):
        return send_file(os.path.join(FRONTEND_DIST, path))
    index_file = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_file):
        return send_file(index_file)
    return jsonify({
        "message": "TERRAWISE AI Backend API is active. Build frontend or run Vite dev server at port 5173.",
        "api_health": "/api/health"
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
