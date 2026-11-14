"""
TERRAWISE AI - SQLAlchemy Database Models
Includes Farmer (max 20 hard cap), Parcel (max 4 per farmer), WeatherSnapshot, AuditLog
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, create_engine
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()

class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    farmer_id = Column(String(10), unique=True, nullable=False, index=True) # AHN-001 or NSK-001
    full_name = Column(String(100), nullable=False)
    village = Column(String(100), nullable=False)
    taluka = Column(String(100), nullable=False)
    district = Column(String(50), nullable=False) # 'Ahilya Nagar' or 'Nashik'
    language = Column(String(5), default="mr", nullable=False) # 'mr', 'hi', 'en'
    mobile = Column(String(20), nullable=True)
    soil_type = Column(String(100), default="Medium Black Soil")
    irrigation_source = Column(String(100), default="Well Irrigation")
    password_hash = Column(String(255), nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    role = Column(String(20), default="farmer", nullable=False) # 'farmer' or 'admin'
    must_change_password = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String(50), default="system", nullable=False)

    parcels = relationship("Parcel", back_populates="farmer", cascade="all, delete-orphan")

    def to_dict(self, include_private: bool = False):
        data = {
            "id": self.id,
            "farmer_id": self.farmer_id,
            "full_name": self.full_name,
            "village": self.village,
            "taluka": self.taluka,
            "district": self.district,
            "language": self.language,
            "mobile": self.mobile if include_private else None,
            "soil_type": self.soil_type,
            "irrigation_source": self.irrigation_source,
            "is_demo": self.is_demo,
            "is_locked": self.is_locked,
            "role": self.role,
            "must_change_password": self.must_change_password,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "parcel_count": len(self.parcels) if self.parcels else 0
        }
        return data


class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    farmer_ref = Column(String(10), ForeignKey("farmers.farmer_id"), nullable=False, index=True)
    parcel_number = Column(Integer, default=1, nullable=False)
    geojson_str = Column(Text, nullable=False)
    centroid_lat = Column(Float, nullable=False)
    centroid_lon = Column(Float, nullable=False)
    area_sqm = Column(Float, nullable=False)
    area_ha = Column(Float, nullable=False)
    area_acre = Column(Float, nullable=False)
    area_guntha = Column(Float, nullable=False)
    boundary_source = Column(String(50), default="farmer_drawn", nullable=False)
    accuracy_m = Column(Float, default=1.0)
    verified_by_officer = Column(Boolean, default=False)
    district = Column(String(50), nullable=False)
    taluka = Column(String(100), nullable=False)
    village = Column(String(100), nullable=False)
    survey_number = Column(String(50), nullable=True) # 7/12 Gat number (private)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    farmer = relationship("Farmer", back_populates="parcels")
    crop_histories = relationship("CropHistory", back_populates="parcel", cascade="all, delete-orphan")
    weather_snapshots = relationship("WeatherSnapshot", back_populates="parcel", cascade="all, delete-orphan")

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "farmer_ref": self.farmer_ref,
            "parcel_number": self.parcel_number,
            "geojson": json.loads(self.geojson_str) if self.geojson_str else None,
            "centroid": {"lat": self.centroid_lat, "lon": self.centroid_lon},
            "area_sqm": self.area_sqm,
            "area_ha": self.area_ha,
            "area_acre": self.area_acre,
            "area_guntha": self.area_guntha,
            "boundary_source": self.boundary_source,
            "accuracy_m": self.accuracy_m,
            "verified_by_officer": self.verified_by_officer,
            "district": self.district,
            "taluka": self.taluka,
            "village": self.village,
            "survey_number": self.survey_number,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class CropHistory(Base):
    __tablename__ = "crop_histories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    crop_id = Column(String(50), nullable=False)
    crop_name = Column(String(100), nullable=False)
    season = Column(String(20), nullable=False) # 'Kharif', 'Rabi', 'Summer'
    year = Column(Integer, nullable=False)
    yield_kg_ha = Column(Float, nullable=True)

    parcel = relationship("Parcel", back_populates="crop_histories")


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=False)
    source = Column(String(50), nullable=False) # 'Open-Meteo', 'NASA POWER'
    data_json = Column(Text, nullable=False)
    observed_at = Column(String(50), nullable=False)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    parcel = relationship("Parcel", back_populates="weather_snapshots")


class DataProvenance(Base):
    __tablename__ = "data_provenances"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_type = Column(String(50), nullable=False)
    record_id = Column(String(50), nullable=False)
    source_type = Column(String(50), nullable=False) # 'API', 'Model', 'Station'
    source_label = Column(String(100), nullable=False)
    observed_at = Column(String(50), nullable=False)
    fetched_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    licence = Column(String(100), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String(100), nullable=False)
    actor_farmer_id = Column(String(50), nullable=False)
    target_farmer_id = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
