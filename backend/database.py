"""
Kshetra - Database Engine and Atomic Limit Locking
Enforces MAX_FARMERS=20 strictly via SQLite BEGIN IMMEDIATE transaction lock.
"""

import os
import json
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from models import Base, Farmer, Parcel, CropHistory, WeatherSnapshot, AuditLog
from utils import hash_password, generate_farmer_id

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "terrawise.db")

MAX_FARMERS_CAP = int(os.environ.get("MAX_FARMERS", "20"))

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False, "timeout": 30.0},
    pool_pre_ping=True
)

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

def init_db():
    """Initializes tables and seeds admin and demo accounts if empty."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        # Check if admin exists
        admin = session.query(Farmer).filter_by(farmer_id="ADM-001").first()
        if not admin:
            admin = Farmer(
                farmer_id="ADM-001",
                full_name="District Agriculture Officer (Admin)",
                village="Ahilya Nagar HQ",
                taluka="Nagar",
                district="Ahilya Nagar",
                language="mr",
                role="admin",
                password_hash=hash_password("Admin-Secure-Pass-2026"),
                is_demo=False,
                must_change_password=False,
                created_by="system"
            )
            session.add(admin)
            session.commit()
            print("Seeded default Admin ADM-001")

        # Seed 4 demo farmers if no farmers exist
        farmer_count = session.query(Farmer).filter(Farmer.role == "farmer").count()
        if farmer_count == 0:
            demo_farmers = [
                {
                    "farmer_id": "AHN-001",
                    "full_name": "Ramesh Vitthal Patil (Demo)",
                    "village": "Babhaleshwar",
                    "taluka": "Rahuri",
                    "district": "Ahilya Nagar",
                    "language": "mr",
                    "soil_type": "Deep Black Soil (Vertisol)",
                    "irrigation_source": "Canal + Well",
                    "password_plaintext": "Mango-River-Tiger-47"
                },
                {
                    "farmer_id": "AHN-002",
                    "full_name": "Sunita Sanjay Shinde (Demo)",
                    "village": "Ghanegaon",
                    "taluka": "Sangamner",
                    "district": "Ahilya Nagar",
                    "language": "mr",
                    "soil_type": "Medium Black Soil",
                    "irrigation_source": "Borewell",
                    "password_plaintext": "Solar-Cloud-Plant-88"
                },
                {
                    "farmer_id": "NSK-001",
                    "full_name": "Eknath Bhikaji Jadhav (Demo)",
                    "village": "Lasalgaon",
                    "taluka": "Niphad",
                    "district": "Nashik",
                    "language": "mr",
                    "soil_type": "Medium Clay Loam",
                    "irrigation_source": "Well Irrigation",
                    "password_plaintext": "Water-Flora-Wheat-19"
                },
                {
                    "farmer_id": "NSK-002",
                    "full_name": "Pravin Dagdu Gaikwad (Demo)",
                    "village": "Vani",
                    "taluka": "Dindori",
                    "district": "Nashik",
                    "language": "mr",
                    "soil_type": "Gravelly Loam",
                    "irrigation_source": "Drip + Farm Pond",
                    "password_plaintext": "Grass-Ocean-Grove-62"
                }
            ]

            # Also load fields.geojson
            geo_fields_path = os.path.normpath(os.path.join(BASE_DIR, "..", "data", "geo", "fields.geojson"))
            fields_by_farmer = {}
            if os.path.exists(geo_fields_path):
                with open(geo_fields_path, "r", encoding="utf-8") as f:
                    f_data = json.load(f)
                    for feat in f_data.get("features", []):
                        f_ref = feat.get("properties", {}).get("farmer_ref")
                        if f_ref:
                            fields_by_farmer[f_ref] = feat

            for df in demo_farmers:
                f_obj = Farmer(
                    farmer_id=df["farmer_id"],
                    full_name=df["full_name"],
                    village=df["village"],
                    taluka=df["taluka"],
                    district=df["district"],
                    language=df["language"],
                    soil_type=df["soil_type"],
                    irrigation_source=df["irrigation_source"],
                    password_hash=hash_password(df["password_plaintext"]),
                    is_demo=True,
                    must_change_password=False,
                    role="farmer",
                    created_by="system"
                )
                session.add(f_obj)
                session.flush()

                # Add parcel if available in fields.geojson
                if df["farmer_id"] in fields_by_farmer:
                    feat = fields_by_farmer[df["farmer_id"]]
                    props = feat.get("properties", {})
                    geom = feat.get("geometry", {})
                    coords = geom.get("coordinates", [[]])[0]
                    c_lon = sum(pt[0] for pt in coords) / len(coords) if coords else 74.0
                    c_lat = sum(pt[1] for pt in coords) / len(coords) if coords else 19.5

                    p_obj = Parcel(
                        farmer_ref=df["farmer_id"],
                        parcel_number=1,
                        geojson_str=json.dumps(geom),
                        centroid_lat=round(c_lat, 6),
                        centroid_lon=round(c_lon, 6),
                        area_sqm=props.get("area_sqm", 20000.0),
                        area_ha=props.get("area_ha", 2.0),
                        area_acre=props.get("area_acre", 4.94),
                        area_guntha=props.get("area_guntha", 197.6),
                        boundary_source=props.get("boundary_source", "farmer_drawn"),
                        accuracy_m=props.get("accuracy_m", 1.5),
                        verified_by_officer=True,
                        district=df["district"],
                        taluka=df["taluka"],
                        village=df["village"],
                        survey_number="Demo Gat-7/12"
                    )
                    session.add(p_obj)

            session.commit()
            print("Seeded 4 demo farmer accounts with verified parcels.")
    except Exception as e:
        session.rollback()
        print("Database initialization error:", e)
    finally:
        session.close()

def create_farmer_atomic(
    full_name: str,
    village: str,
    taluka: str,
    district: str,
    language: str = "mr",
    mobile: str = None,
    soil_type: str = "Medium Black Soil",
    irrigation_source: str = "Well Irrigation",
    actor_id: str = "system"
):
    """
    Enforces the strict MAX_FARMERS hard limit in a locked SQLite transaction (BEGIN IMMEDIATE).
    Returns (success: bool, data_or_error: dict, status_code: int)
    """
    conn = engine.raw_connection()
    try:
        cursor = conn.cursor()
        # Acquire reserved write lock
        cursor.execute("BEGIN IMMEDIATE")

        # Count current non-admin farmers
        cursor.execute("SELECT COUNT(*) FROM farmers WHERE role = 'farmer'")
        current_count = cursor.fetchone()[0]

        if current_count >= MAX_FARMERS_CAP:
            conn.rollback()
            return False, {
                "error": "FARMER_LIMIT_REACHED",
                "message": f"Pilot limit of {MAX_FARMERS_CAP} farmers has been reached. No additional farmers can be registered.",
                "current_count": current_count,
                "max_allowed": MAX_FARMERS_CAP
            }, 409

        # Generate next serial number
        cursor.execute("SELECT MAX(id) FROM farmers WHERE role = 'farmer'")
        max_id_row = cursor.fetchone()[0]
        next_serial = (max_id_row or 0) + 1
        farmer_id = generate_farmer_id(district, next_serial)

        # Generate natural password
        from utils import generate_natural_password
        plain_password = generate_natural_password()
        hashed = hash_password(plain_password)

        created_at_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute(
            """
            INSERT INTO farmers (
                farmer_id, full_name, village, taluka, district, language, mobile,
                soil_type, irrigation_source, password_hash, is_demo, is_locked,
                failed_login_attempts, role, must_change_password, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'farmer', 1, ?, ?)
            """,
            (farmer_id, full_name, village, taluka, district, language, mobile,
             soil_type, irrigation_source, hashed, created_at_str, actor_id)
        )

        # Audit log
        cursor.execute(
            """
            INSERT INTO audit_logs (action, actor_farmer_id, target_farmer_id, details, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("CREATE_FARMER", actor_id, farmer_id, f"Registered new farmer {full_name} in {taluka}, {district}", created_at_str)
        )

        conn.commit()

        return True, {
            "farmer_id": farmer_id,
            "full_name": full_name,
            "district": district,
            "taluka": taluka,
            "village": village,
            "language": language,
            "one_time_password": plain_password, # Only present in response for credential card creation
            "current_count": current_count + 1,
            "max_allowed": MAX_FARMERS_CAP
        }, 201

    except Exception as e:
        conn.rollback()
        return False, {"error": "DATABASE_ERROR", "message": str(e)}, 500
    finally:
        conn.close()
