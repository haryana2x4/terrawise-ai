"""Flask CLI management commands: create-admin, ingest, send-monthly, backup, doctor."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import click
from flask import Flask, current_app

from app.extensions import db_manager
from app.jobs import run_backup_sqlite_db, run_monthly_digest_job, run_telemetry_ingest_job
from app.repositories import FarmerRepository
from app.security import hash_password


def register_cli_commands(app: Flask) -> None:
    @app.cli.command("create-admin")
    @click.option("--admin-id", default="ADMIN", help="Administrator login ID (default: ADMIN)")
    @click.option("--name", default="Kshetra Agricultural Officer", help="Administrator display name")
    @click.option("--password", default=None, help="Admin password (or set KSHETRA_ADMIN_PASSWORD env var)")
    def create_admin_cmd(admin_id: str, name: str, password: Optional[str]) -> None:
        """Create or update the initial administrator account without hard-coded credentials."""
        pwd = password or os.environ.get("KSHETRA_ADMIN_PASSWORD")
        if not pwd:
            pwd = click.prompt("Enter new administrator password (min 8 chars)", hide_input=True, confirmation_prompt=True)
        pwd = pwd.strip()
        if len(pwd) < 8:
            raise click.ClickException("Administrator password must be at least 8 characters long.")

        with db_manager.session_scope() as session:
            admin = FarmerRepository.create_or_update_admin(
                session,
                farmer_id=admin_id.strip().upper(),
                name=name.strip(),
                password_hash=hash_password(pwd),
            )
            click.echo(f"[OK] Administrator account '{admin.farmer_id}' ({admin.name}) is ready.")

    @app.cli.command("ingest")
    def ingest_cmd() -> None:
        """Fetch latest weather & soil telemetry for all registered parcel grids."""
        stats = run_telemetry_ingest_job(db_manager)
        click.echo(f"[OK] Telemetry ingest complete: {stats}")

    @app.cli.command("send-monthly")
    def send_monthly_cmd() -> None:
        """Dispatch monthly water & crop advisory digest to all active farmers."""
        stats = run_monthly_digest_job(db_manager)
        click.echo(f"[OK] Monthly advisory dispatched to {stats['dispatched']} farmers.")

    @app.cli.command("backup")
    @click.option("--out-dir", default=None, help="Target directory for SQLite backup")
    def backup_cmd(out_dir: Optional[str]) -> None:
        """Create a consistent timestamped backup of the SQLite database."""
        db_uri = current_app.config["SQLALCHEMY_DATABASE_URI"]
        if not db_uri.startswith("sqlite:///"):
            raise click.ClickException("Built-in file backup is for SQLite databases; use pg_dump for PostgreSQL.")
        db_path = Path(db_uri.replace("sqlite:///", ""))
        target_dir = Path(out_dir) if out_dir else (current_app.config["BASE_DIR"] / "backups")
        dest = run_backup_sqlite_db(db_path, target_dir)
        click.echo(f"[OK] Database backed up to {dest}")

    @app.cli.command("doctor")
    def doctor_cmd() -> None:
        """Run self-diagnostics on database, geo boundary files, crops catalog, and fonts."""
        db_ok = db_manager.ping()
        data_dir: Path = current_app.config["DATA_DIR"]
        checks = {
            "database_ping": db_ok,
            "crops_catalog": (data_dir / "crops.json").exists(),
            "districts_geojson": (data_dir / "geo" / "districts.geojson").exists(),
            "talukas_geojson": (data_dir / "geo" / "talukas.geojson").exists(),
            "devanagari_font": (current_app.config["BACKEND_DIR"] / "fonts" / "NotoSansDevanagari-Regular.ttf").exists(),
        }
        for name, ok in checks.items():
            status = "PASS" if ok else "FAIL"
            click.echo(f"[{status}] {name}")
        if not all(checks.values()):
            raise click.ClickException("One or more diagnostic checks failed.")
        click.echo("[OK] All Kshetra production readiness checks passed.")
