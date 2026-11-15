"""Background worker process for scheduled telemetry ingestion and daily database backups."""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from app import create_app
from app.extensions import db_manager
from app.jobs import run_backup_sqlite_db, run_telemetry_ingest_job

logger = logging.getLogger("kshetra.worker")


def main() -> None:
    app = create_app()
    interval_sec = int(os.environ.get("WORKER_INTERVAL_SECONDS", "3600"))
    logger.info("Kshetra background worker started (interval=%ds)", interval_sec)

    with app.app_context():
        while True:
            try:
                stats = run_telemetry_ingest_job(db_manager)
                logger.info("Scheduled telemetry ingest completed: %s", stats)

                db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
                if db_uri.startswith("sqlite:///"):
                    db_path = Path(db_uri.replace("sqlite:///", ""))
                    backup_dir = app.config["BASE_DIR"] / "backups"
                    run_backup_sqlite_db(db_path, backup_dir)
            except Exception as exc:
                logger.exception("Worker cycle error: %s", exc)
            time.sleep(interval_sec)


if __name__ == "__main__":
    main()
