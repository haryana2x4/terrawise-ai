"""Data access repositories enforcing transactional invariants and audit logging."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import AppError
from app.extensions import DatabaseManager
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
    RefreshToken,
    SourceHealthRecord,
    WeatherSnapshot,
)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class FarmerRepository:
    """Repository for Farmer identity, 40-farmer cap enforcement, and refresh tokens."""

    @staticmethod
    def count_active_farmers(session: Session) -> int:
        return (
            session.query(Farmer)
            .filter(Farmer.role == "farmer", Farmer.deleted_at.is_(None))
            .count()
        )

    @staticmethod
    def get_by_farmer_id(session: Session, farmer_id: str) -> Optional[Farmer]:
        return (
            session.query(Farmer)
            .filter(Farmer.farmer_id == farmer_id, Farmer.deleted_at.is_(None))
            .first()
        )

    @staticmethod
    def list_active_farmers(session: Session) -> List[Farmer]:
        return (
            session.query(Farmer)
            .filter(Farmer.role == "farmer", Farmer.deleted_at.is_(None))
            .order_by(Farmer.created_at.desc())
            .all()
        )

    @staticmethod
    def create_farmer_atomic(
        db_manager: DatabaseManager,
        *,
        farmer_id: str,
        name: str,
        password_hash: str,
        district: str,
        taluka: str,
        village: str = "",
        preferred_language: str = "mr",
        mobile_encrypted: Optional[str] = None,
        holder_relation: Optional[str] = None,
        farmer_category: str = "small",
        primary_crops: Optional[str] = None,
        farming_experience_years: Optional[int] = None,
        bio_note: Optional[str] = None,
        actor_id: str = "ADMIN",
        ip_address: Optional[str] = None,
        max_farmers: int = 40,
    ) -> Dict[str, Any]:
        """Atomically enforce the 40-farmer hard limit inside a locked transaction."""
        session = db_manager.get_session()
        try:
            dialect = session.bind.dialect.name if session.bind else "sqlite"
            if dialect == "sqlite":
                session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            else:
                session.query(Farmer).filter(Farmer.role == "farmer").with_for_update().all()

            current_count = FarmerRepository.count_active_farmers(session)
            if current_count >= max_farmers:
                session.rollback()
                raise AppError(
                    "FARMER_CAP_REACHED",
                    f"Maximum capacity of {max_farmers} active farmer accounts has been reached ({current_count}/{max_farmers}).",
                    409,
                    {"active_count": current_count, "max_farmers": max_farmers},
                )

            existing = session.query(Farmer).filter(Farmer.farmer_id == farmer_id).first()
            if existing is not None:
                session.rollback()
                raise AppError("DUPLICATE_FARMER_ID", "Generated Farmer ID already exists.", 409)

            farmer = Farmer(
                farmer_id=farmer_id,
                name=name.strip(),
                role="farmer",
                password_hash=password_hash,
                must_change_password=True,
                district=district,
                taluka=taluka,
                village=village.strip(),
                preferred_language=preferred_language,
                mobile_encrypted=mobile_encrypted,
                holder_relation=holder_relation,
                farmer_category=farmer_category or "small",
                primary_crops=primary_crops,
                farming_experience_years=farming_experience_years,
                bio_note=bio_note,
            )
            session.add(farmer)
            session.add(
                AuditLog(
                    actor_id=actor_id,
                    action="CREATE_FARMER",
                    target_id=farmer_id,
                    details_json=json.dumps(
                        {"district": district, "taluka": taluka, "slot": current_count + 1}
                    ),
                    ip_address=ip_address,
                )
            )
            session.commit()
            session.refresh(farmer)
            return farmer.to_dict()
        except AppError:
            raise
        except Exception as exc:
            session.rollback()
            raise AppError("DATABASE_ERROR", f"Failed to create farmer account: {exc}", 500) from exc
        finally:
            session.close()

    @staticmethod
    def create_or_update_admin(
        session: Session,
        *,
        farmer_id: str,
        name: str,
        password_hash: str,
        preferred_language: str = "en",
    ) -> Farmer:
        existing = session.query(Farmer).filter(Farmer.farmer_id == farmer_id).first()
        if existing:
            existing.name = name
            existing.role = "admin"
            existing.password_hash = password_hash
            existing.must_change_password = False
            existing.failed_attempts = 0
            existing.locked_until = None
            existing.deleted_at = None
            farmer = existing
        else:
            farmer = Farmer(
                farmer_id=farmer_id,
                name=name,
                role="admin",
                password_hash=password_hash,
                must_change_password=False,
                district="Ahilya Nagar",
                taluka="Rahuri",
                village="Headquarters",
                preferred_language=preferred_language,
                consent_accepted_at=_utcnow_naive(),
            )
            session.add(farmer)
        session.add(
            AuditLog(
                actor_id="CLI",
                action="UPSERT_ADMIN",
                target_id=farmer_id,
                details_json=json.dumps({"role": "admin"}),
            )
        )
        session.commit()
        session.refresh(farmer)
        return farmer

    @staticmethod
    def record_failed_login(
        session: Session,
        farmer: Farmer,
        max_attempts: int = 5,
        lockout_minutes: int = 15,
    ) -> None:
        farmer.failed_attempts = (farmer.failed_attempts or 0) + 1
        if farmer.failed_attempts >= max_attempts:
            farmer.locked_until = _utcnow_naive() + timedelta(minutes=lockout_minutes)
        session.commit()

    @staticmethod
    def record_successful_login(session: Session, farmer: Farmer) -> None:
        farmer.failed_attempts = 0
        farmer.locked_until = None
        farmer.last_login = _utcnow_naive()
        session.commit()

    @staticmethod
    def issue_refresh_token(
        session: Session,
        *,
        farmer_id: str,
        token_hash: str,
        family_id: str,
        expires_at: datetime,
    ) -> RefreshToken:
        rt = RefreshToken(
            farmer_id=farmer_id,
            token_hash=token_hash,
            family_id=family_id,
            revoked=False,
            expires_at=expires_at.replace(tzinfo=None) if expires_at.tzinfo else expires_at,
        )
        session.add(rt)
        session.commit()
        return rt

    @staticmethod
    def rotate_refresh_token(
        session: Session,
        *,
        old_token_hash: str,
        new_token_hash: str,
        new_expires_at: datetime,
    ) -> Tuple[Farmer, RefreshToken]:
        record = session.query(RefreshToken).filter(RefreshToken.token_hash == old_token_hash).first()
        if not record:
            raise AppError("INVALID_REFRESH_TOKEN", "Refresh token not recognized.", 401)

        if record.revoked:
            # Reuse detection: revoke entire token family
            session.query(RefreshToken).filter(
                RefreshToken.family_id == record.family_id
            ).update({"revoked": True})
            session.commit()
            raise AppError(
                "REFRESH_TOKEN_REUSE",
                "Refresh token reuse detected. All sessions in this token family have been revoked.",
                401,
            )

        if record.expires_at < _utcnow_naive():
            record.revoked = True
            session.commit()
            raise AppError("REFRESH_TOKEN_EXPIRED", "Refresh token has expired.", 401)

        farmer = FarmerRepository.get_by_farmer_id(session, record.farmer_id)
        if not farmer:
            raise AppError("FARMER_NOT_FOUND", "Account no longer exists.", 401)

        record.revoked = True
        new_rt = RefreshToken(
            farmer_id=farmer.farmer_id,
            token_hash=new_token_hash,
            family_id=record.family_id,
            revoked=False,
            expires_at=new_expires_at.replace(tzinfo=None) if new_expires_at.tzinfo else new_expires_at,
        )
        session.add(new_rt)
        session.commit()
        return farmer, new_rt

    @staticmethod
    def revoke_all_refresh_tokens(session: Session, farmer_id: str) -> None:
        session.query(RefreshToken).filter(RefreshToken.farmer_id == farmer_id).update(
            {"revoked": True}
        )
        session.commit()

    @staticmethod
    def delete_farmer_and_data(
        session: Session, farmer: Farmer, actor_id: str, ip_address: Optional[str] = None
    ) -> None:
        fid = farmer.farmer_id
        session.query(AssistantMessage).filter(AssistantMessage.farmer_id == fid).delete()
        session.query(FeedbackEntry).filter(FeedbackEntry.farmer_id == fid).delete()
        session.query(NotificationLog).filter(NotificationLog.farmer_id == fid).delete()
        session.query(RefreshToken).filter(RefreshToken.farmer_id == fid).delete()
        session.query(FieldObservation).filter(FieldObservation.farmer_id == fid).delete()
        for parcel in list(farmer.parcels):
            session.delete(parcel)
        session.delete(farmer)
        session.add(
            AuditLog(
                actor_id=actor_id,
                action="DELETE_FARMER_DATA",
                target_id=fid,
                details_json=json.dumps({"compliance": "DPDP_2023_ERASURE"}),
                ip_address=ip_address,
            )
        )
        session.commit()


class ParcelRepository:
    """Repository for Parcel CRUD with atomic non-overlapping & max-parcel checks."""

    @staticmethod
    def create_parcel_atomic(
        db_manager: DatabaseManager,
        *,
        farmer_id: str,
        name: str,
        survey_number_encrypted: Optional[str],
        geojson_str: str,
        area_acres: float,
        area_gunthas: float,
        centroid_lat: float,
        centroid_lon: float,
        soil_type: str,
        irrigation_source: str,
        planting_date: Optional[str],
        overlap_checker: Callable[[str, List[Tuple[int, str, str]]], Tuple[bool, Optional[str]]],
        max_parcels: int = 4,
    ) -> Dict[str, Any]:
        session = db_manager.get_session()
        try:
            dialect = session.bind.dialect.name if session.bind else "sqlite"
            if dialect == "sqlite":
                session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            else:
                session.query(Parcel).with_for_update().all()

            farmer_parcels = (
                session.query(Parcel).filter(Parcel.farmer_id == farmer_id).count()
            )
            if farmer_parcels >= max_parcels:
                session.rollback()
                raise AppError(
                    "PARCEL_LIMIT_REACHED",
                    f"Maximum of {max_parcels} parcels allowed per farmer account.",
                    400,
                )

            all_parcels = session.query(Parcel).all()
            existing_tuples = [(p.id, p.farmer_id, p.geojson) for p in all_parcels]
            has_overlap, overlap_msg = overlap_checker(geojson_str, existing_tuples)
            if has_overlap:
                session.rollback()
                raise AppError("PARCEL_OVERLAP", overlap_msg or "Parcel overlaps an existing registered boundary.", 409)

            parcel = Parcel(
                farmer_id=farmer_id,
                name=name.strip(),
                survey_number_encrypted=survey_number_encrypted,
                geojson=geojson_str,
                area_acres=area_acres,
                area_gunthas=area_gunthas,
                centroid_lat=centroid_lat,
                centroid_lon=centroid_lon,
                soil_type=soil_type,
                irrigation_source=irrigation_source,
                planting_date=planting_date,
                land_verified=False,
            )
            session.add(parcel)
            session.commit()
            session.refresh(parcel)
            return parcel.to_dict()
        except AppError:
            raise
        except Exception as exc:
            session.rollback()
            raise AppError("DATABASE_ERROR", f"Could not save parcel: {exc}", 500) from exc
        finally:
            session.close()


class TelemetryRepository:
    """Repository for weather cache, source health, field observations, and crop history."""

    @staticmethod
    def record_source_health(
        session: Session,
        source_name: str,
        *,
        success: bool,
        latency_ms: float,
        error_msg: Optional[str] = None,
    ) -> None:
        rec = (
            session.query(SourceHealthRecord)
            .filter(SourceHealthRecord.source_name == source_name)
            .first()
        )
        now = _utcnow_naive()
        if not rec:
            rec = SourceHealthRecord(
                source_name=source_name,
                status="healthy" if success else "degraded",
                consecutive_failures=0,
            )
            session.add(rec)

        rec.latency_ms = round(float(latency_ms), 1)
        rec.updated_at = now
        if success:
            rec.status = "healthy"
            rec.last_success_at = now
            rec.consecutive_failures = 0
            rec.last_error = None
        else:
            rec.consecutive_failures = (rec.consecutive_failures or 0) + 1
            rec.last_failure_at = now
            rec.last_error = (error_msg or "Upstream request failed")[:300]
            rec.status = "down" if rec.consecutive_failures >= 3 else "degraded"
        session.commit()

    @staticmethod
    def list_source_health(session: Session) -> List[Dict[str, Any]]:
        rows = session.query(SourceHealthRecord).order_by(SourceHealthRecord.source_name.asc()).all()
        return [r.to_dict() for r in rows]


class CommunityRepository:
    """Repository for announcements, feedback, assistant chat history, notifications, and audit logs."""

    @staticmethod
    def log_audit(
        session: Session,
        *,
        actor_id: str,
        action: str,
        target_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_id=actor_id,
            action=action,
            target_id=target_id,
            details_json=json.dumps(details or {}),
            ip_address=ip_address,
        )
        session.add(entry)
        session.commit()
        return entry
