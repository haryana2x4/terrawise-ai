"""Kshetra (formerly TERRAWISE AI) Application Factory."""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, Optional

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from app.api.v1 import api_v1
from app.cli import register_cli_commands
from app.config import get_config
from app.core import AppError, configure_logging, error_response
from app.extensions import Base, db_manager
from app.repositories import TelemetryRepository
from app.security import apply_security_headers
from app.services import (
    AdviceAndRiskService,
    AssistantService,
    CredentialCardService,
    GeoValidationService,
)

# Ensure models are imported before create_all
import app.models  # noqa: F401


def create_app(
    env_name: Optional[str] = None,
    test_config: Optional[Dict[str, Any]] = None,
) -> Flask:
    """Create and configure the production-grade Kshetra Flask application."""
    app = Flask(__name__)
    cfg = get_config(env_name)
    app.config.from_object(cfg)

    if test_config:
        app.config.update(test_config)

    if hasattr(cfg, "validate_production"):
        cfg.validate_production()

    configure_logging(debug=bool(app.config.get("DEBUG", False)))

    # Initialize database and schema
    db_manager.init_app(app)
    if db_manager.engine is not None:
        Base.metadata.create_all(bind=db_manager.engine)

    # Initialize domain services once per app instance
    data_dir = app.config["DATA_DIR"]
    fonts_dir = app.config["BACKEND_DIR"] / "fonts"
    geo_service = GeoValidationService(data_dir=data_dir)
    advice_service = AdviceAndRiskService(data_dir=data_dir)
    card_service = CredentialCardService(
        fonts_dir=fonts_dir,
        support_contact=str(app.config.get("SUPPORT_CONTACT") or ""),
    )
    assistant_service = AssistantService(config=app.config, advice_service=advice_service)

    app.extensions["geo_service"] = geo_service
    app.extensions["advice_service"] = advice_service
    app.extensions["card_service"] = card_service
    app.extensions["assistant_service"] = assistant_service

    # Explicit CORS origins (never '*' with credentials)
    CORS(
        app,
        origins=app.config.get("CORS_ORIGINS", ["http://localhost:5173"]),
        supports_credentials=True,
        expose_headers=["X-Request-Id", "ETag", "Content-Disposition"],
    )

    @app.before_request
    def attach_request_id() -> None:
        g.request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:16]

    @app.after_request
    def attach_security_headers(response):
        return apply_security_headers(response)

    # Standardized JSON error handlers
    @app.errorhandler(AppError)
    def handle_app_error(err: AppError):
        return error_response(err.code, err.message, err.status_code, err.details)

    @app.errorhandler(HTTPException)
    def handle_http_exception(err: HTTPException):
        code = (err.name or "HTTP_ERROR").upper().replace(" ", "_")
        return error_response(code, err.description or "HTTP error", err.code or 500)

    @app.errorhandler(Exception)
    def handle_unexpected_exception(err: Exception):
        logging.getLogger(__name__).exception("Unhandled exception: %s", err)
        return error_response(
            "INTERNAL_SERVER_ERROR",
            "An unexpected internal error occurred.",
            500,
        )

    # Liveness & Readiness Probes
    @app.route("/healthz", methods=["GET"])
    def healthz():
        return jsonify({"status": "alive", "request_id": getattr(g, "request_id", "")}), 200

    @app.route("/readyz", methods=["GET"])
    def readyz():
        db_ok = db_manager.ping()
        crops_ok = len(advice_service.crops) > 0
        with db_manager.session_scope() as session:
            sources = TelemetryRepository.list_source_health(session)
        ready = db_ok and crops_ok
        return (
            jsonify(
                {
                    "status": "ready" if ready else "not_ready",
                    "database": "ok" if db_ok else "unreachable",
                    "catalog_loaded": crops_ok,
                    "upstream_sources": sources,
                }
            ),
            200 if ready else 503,
        )

    # Register /api/v1 primary routes and /api backward-compatible alias
    app.register_blueprint(api_v1, url_prefix="/api/v1")
    app.register_blueprint(api_v1, name="api_compat", url_prefix="/api")

    # Register Flask CLI commands
    register_cli_commands(app)

    return app
