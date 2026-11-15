"""Background jobs: telemetry refresh, monthly notifications, and database backup."""
from __future__ import annotations

import logging
import shutil
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

from app.extensions import DatabaseManager
from app.integrations import OpenMeteoClient
from app.models import AssistantMessage, Farmer, NotificationLog, Parcel

logger = logging.getLogger(__name__)


def run_telemetry_ingest_job(db_manager: DatabaseManager, skip_network: bool = False) -> Dict[str, Any]:
    """Refresh weather cache for all unique parcel coordinate grids."""
    refreshed = 0
    errors = 0
    with db_manager.session_scope() as session:
        parcels = session.query(Parcel).all()
        seen_grids = set()
        for p in parcels:
            grid = (round(p.centroid_lat, 2), round(p.centroid_lon, 2))
            if grid in seen_grids:
                continue
            seen_grids.add(grid)
            res = OpenMeteoClient.fetch_weather(
                grid[0], grid[1], db_session=session, skip_network=skip_network
            )
            if res.get("status") == "ok":
                refreshed += 1
            else:
                errors += 1
    return {"grids_checked": len(seen_grids), "refreshed": refreshed, "errors": errors}


def run_monthly_digest_job(db_manager: DatabaseManager) -> Dict[str, Any]:
    """Generate monthly water & crop advisory notification entries for active farmers."""
    dispatched = 0
    with db_manager.session_scope() as session:
        farmers = (
            session.query(Farmer)
            .filter(Farmer.role == "farmer", Farmer.deleted_at.is_(None))
            .all()
        )
        month_tag = datetime.now(timezone.utc).strftime("%Y-%m")
        for f in farmers:
            msg = (
                f"[{month_tag}] Kshetra Monthly Advisory for {f.name} ({f.taluka}, {f.district}): "
                f"Review 7-day rainfall forecast and soil moisture before scheduling irrigation."
            )
            session.add(
                NotificationLog(
                    farmer_id=f.farmer_id,
                    channel="in_app",
                    template_name="monthly_digest",
                    status="delivered",
                    message_preview=msg[:280],
                )
            )
            dispatched += 1
        session.commit()
    return {"dispatched": dispatched}


def run_backup_sqlite_db(db_path: Path, backup_dir: Path, keep_last: int = 7) -> Path:
    """Perform a consistent online SQLite backup using sqlite3.Connection.backup()."""
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dest_path = backup_dir / f"kshetra_backup_{ts}.db"

    if db_path.exists():
        src_conn = sqlite3.connect(str(db_path))
        dst_conn = sqlite3.connect(str(dest_path))
        with dst_conn:
            src_conn.backup(dst_conn)
        dst_conn.close()
        src_conn.close()
    else:
        dest_path.write_bytes(b"")

    # Rotate older backups
    backups = sorted(backup_dir.glob("kshetra_backup_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old_file in backups[keep_last:]:
        try:
            old_file.unlink()
        except OSError:
            pass
    return dest_path
