"""SQLAlchemy 2.x domain models for Kshetra (production schema, encrypted PII, DPDP consent, audit log)."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Farmer(Base):
    """Registered farmer or administrator account (hard cap of 20 active farmers enforced in repository)."""

    __tablename__ = "farmers"
    __table_args__ = (
        CheckConstraint("role IN ('farmer', 'admin')", name="ck_farmers_role"),
        CheckConstraint("preferred_language IN ('mr', 'hi', 'en')", name="ck_farmers_lang"),
        Index("ix_farmers_role_active", "role", "deleted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="farmer")
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    district: Mapped[str] = mapped_column(String(64), nullable=False, default="Ahilya Nagar")
    taluka: Mapped[str] = mapped_column(String(64), nullable=False, default="Rahuri")
    village: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    preferred_language: Mapped[str] = mapped_column(String(8), nullable=False, default="mr")
    mobile_encrypted: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # DPDP Act 2023 consent & lifecycle
    consent_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    parcels: Mapped[List["Parcel"]] = relationship(
        "Parcel", back_populates="farmer", cascade="all, delete-orphan"
    )

    def is_locked(self) -> bool:
        if self.locked_until is None:
            return False
        return self.locked_until > _utcnow()

    def to_dict(
        self,
        include_sensitive: bool = False,
        decrypted_mobile: Optional[str] = None,
    ) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "farmer_id": self.farmer_id,
            "name": self.name,
            "role": self.role,
            "district": self.district,
            "taluka": self.taluka,
            "village": self.village,
            "preferred_language": self.preferred_language,
            "must_change_password": self.must_change_password,
            "is_locked": self.is_locked(),
            "failed_attempts": self.failed_attempts,
            "consent_accepted": self.consent_accepted_at is not None,
            "consent_accepted_at": (
                self.consent_accepted_at.isoformat() + "Z" if self.consent_accepted_at else None
            ),
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "last_login": self.last_login.isoformat() + "Z" if self.last_login else None,
            "parcel_count": len(self.parcels) if self.parcels is not None else 0,
        }
        if include_sensitive:
            data["mobile"] = decrypted_mobile
        return data


class Parcel(Base):
    """Mapped agricultural land parcel (max 4 per farmer; non-overlapping across all farmers)."""

    __tablename__ = "parcels"
    __table_args__ = (
        CheckConstraint("area_acres > 0", name="ck_parcels_positive_area"),
        Index("ix_parcels_farmer_id", "farmer_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("farmers.farmer_id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Field 1")
    survey_number_encrypted: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    geojson: Mapped[str] = mapped_column(Text, nullable=False)
    area_acres: Mapped[float] = mapped_column(Float, nullable=False)
    area_gunthas: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    centroid_lat: Mapped[float] = mapped_column(Float, nullable=False)
    centroid_lon: Mapped[float] = mapped_column(Float, nullable=False)

    soil_type: Mapped[str] = mapped_column(String(64), nullable=False, default="medium_black")
    irrigation_source: Mapped[str] = mapped_column(String(64), nullable=False, default="rainfed")
    planting_date: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)

    # Land verification badge (Admin verifies against 7/12 / AgriStack)
    land_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    verified_by: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    farmer: Mapped["Farmer"] = relationship("Farmer", back_populates="parcels")
    crop_history: Mapped[List["CropHistory"]] = relationship(
        "CropHistory", back_populates="parcel", cascade="all, delete-orphan"
    )

    def to_dict(self, decrypted_survey_number: Optional[str] = None) -> Dict[str, Any]:
        try:
            geom = json.loads(self.geojson) if isinstance(self.geojson, str) else self.geojson
        except Exception:
            geom = None
        return {
            "id": self.id,
            "farmer_id": self.farmer_id,
            "name": self.name,
            "survey_number": decrypted_survey_number,
            "geojson": geom,
            "area_acres": round(float(self.area_acres), 3),
            "area_gunthas": round(float(self.area_gunthas), 2),
            "centroid_lat": round(float(self.centroid_lat), 6),
            "centroid_lon": round(float(self.centroid_lon), 6),
            "soil_type": self.soil_type,
            "irrigation_source": self.irrigation_source,
            "planting_date": self.planting_date,
            "land_verified": self.land_verified,
            "verified_by": self.verified_by,
            "verified_at": self.verified_at.isoformat() + "Z" if self.verified_at else None,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class CropHistory(Base):
    """Historical crop rotation record per parcel."""

    __tablename__ = "crop_history"
    __table_args__ = (Index("ix_crop_history_parcel", "parcel_id", "year"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    parcel_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("parcels.id", ondelete="CASCADE"), nullable=False
    )
    crop_id: Mapped[str] = mapped_column(String(64), nullable=False)
    crop_name: Mapped[str] = mapped_column(String(100), nullable=False)
    season: Mapped[str] = mapped_column(String(32), nullable=False, default="kharif")
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    yield_quintals: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    parcel: Mapped["Parcel"] = relationship("Parcel", back_populates="crop_history")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "parcel_id": self.parcel_id,
            "crop_id": self.crop_id,
            "crop_name": self.crop_name,
            "season": self.season,
            "year": self.year,
            "yield_quintals": self.yield_quintals,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class FieldObservation(Base):
    """Farmer-recorded field observation (e.g. daily rain gauge, pest sighting, irrigation)."""

    __tablename__ = "field_observations"
    __table_args__ = (Index("ix_field_obs_farmer_parcel", "farmer_id", "parcel_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("farmers.farmer_id", ondelete="CASCADE"), nullable=False
    )
    parcel_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("parcels.id", ondelete="SET NULL"), nullable=True
    )
    observed_date: Mapped[str] = mapped_column(String(16), nullable=False)
    rain_mm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    soil_moisture_state: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    pest_seen: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "farmer_id": self.farmer_id,
            "parcel_id": self.parcel_id,
            "observed_date": self.observed_date,
            "rain_mm": self.rain_mm,
            "soil_moisture_state": self.soil_moisture_state,
            "pest_seen": self.pest_seen,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class WeatherSnapshot(Base):
    """Cached real weather & soil-moisture telemetry keyed by rounded coordinate grid."""

    __tablename__ = "weather_snapshots"
    __table_args__ = (Index("ix_weather_grid", "lat_grid", "lon_grid", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lat_grid: Mapped[str] = mapped_column(String(16), nullable=False)
    lon_grid: Mapped[str] = mapped_column(String(16), nullable=False)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False, default="Open-Meteo")
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)


class RefreshToken(Base):
    """Hashed refresh token with token-family tracking for reuse detection and revocation."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_token_farmer", "farmer_id", "family_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("farmers.farmer_id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    family_id: Mapped[str] = mapped_column(String(64), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)


class AssistantMessage(Base):
    """Krishi Mitra assistant conversation log per farmer (auto-pruned after 90 days)."""

    __tablename__ = "assistant_messages"
    __table_args__ = (Index("ix_assistant_farmer_time", "farmer_id", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("farmers.farmer_id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="mr")
    provider: Mapped[str] = mapped_column(String(32), nullable=False, default="grounded")
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feedback_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1 or -1
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "farmer_id": self.farmer_id,
            "role": self.role,
            "content": self.content,
            "language": self.language,
            "provider": self.provider,
            "tokens_used": self.tokens_used,
            "feedback_rating": self.feedback_rating,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class Announcement(Base):
    """Officer / Admin taluka- or district-targeted agricultural announcement."""

    __tablename__ = "announcements"
    __table_args__ = (Index("ix_announcement_target", "district", "taluka", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    district: Mapped[str] = mapped_column(String(64), nullable=False, default="Ahilya Nagar")
    taluka: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # None = all talukas
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="info")
    title_mr: Mapped[str] = mapped_column(String(200), nullable=False)
    title_hi: Mapped[str] = mapped_column(String(200), nullable=False)
    title_en: Mapped[str] = mapped_column(String(200), nullable=False)
    body_mr: Mapped[str] = mapped_column(Text, nullable=False)
    body_hi: Mapped[str] = mapped_column(Text, nullable=False)
    body_en: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[str] = mapped_column(String(32), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "district": self.district,
            "taluka": self.taluka or "All",
            "severity": self.severity,
            "title": {"mr": self.title_mr, "hi": self.title_hi, "en": self.title_en},
            "body": {"mr": self.body_mr, "hi": self.body_hi, "en": self.body_en},
            "created_by": self.created_by,
            "active": self.active,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class FeedbackEntry(Base):
    """Farmer feedback on advice cards or problem reports visible to Admin."""

    __tablename__ = "feedback_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(32), nullable=False, default="advice")
    target_ref: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1 or -1
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "farmer_id": self.farmer_id,
            "target_type": self.target_type,
            "target_ref": self.target_ref,
            "rating": self.rating,
            "comment": self.comment,
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class SourceHealthRecord(Base):
    """Live telemetry health status for Open-Meteo, NASA POWER, ISRIC SoilGrids, Agmarknet, etc."""

    __tablename__ = "source_health_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="healthy")
    last_success_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_failure_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    latency_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        stale_48h = False
        if self.last_success_at:
            age_hours = (_utcnow() - self.last_success_at).total_seconds() / 3600.0
            stale_48h = age_hours > 48.0
        return {
            "source_name": self.source_name,
            "status": "stale" if stale_48h and self.status == "healthy" else self.status,
            "stale_over_48h": stale_48h,
            "last_success_at": (
                self.last_success_at.isoformat() + "Z" if self.last_success_at else None
            ),
            "last_failure_at": (
                self.last_failure_at.isoformat() + "Z" if self.last_failure_at else None
            ),
            "latency_ms": round(self.latency_ms, 1) if self.latency_ms is not None else None,
            "consecutive_failures": self.consecutive_failures,
            "last_error": self.last_error,
            "updated_at": self.updated_at.isoformat() + "Z" if self.updated_at else None,
        }


class NotificationLog(Base):
    """Log of monthly water/crop advisory notifications sent to farmers."""

    __tablename__ = "notification_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farmer_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(24), nullable=False, default="in_app")
    template_name: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="delivered")
    message_preview: Mapped[str] = mapped_column(String(300), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "farmer_id": self.farmer_id,
            "channel": self.channel,
            "template_name": self.template_name,
            "status": self.status,
            "message_preview": self.message_preview,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


class AuditLog(Base):
    """Immutable audit trail for admin actions, logins, password resets, and DPDP data deletions."""

    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_created", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    actor_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    details_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_utcnow)

    def to_dict(self) -> Dict[str, Any]:
        try:
            details = json.loads(self.details_json)
        except Exception:
            details = {}
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "action": self.action,
            "target_id": self.target_id,
            "details": details,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }
