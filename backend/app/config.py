"""Environment-driven configuration for Development, Testing, and Production."""
from __future__ import annotations

import os
from pathlib import Path
from typing import List


class BaseConfig:
    """Shared base configuration across all environments."""

    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"

    APP_NAME: str = "Kshetra"
    APP_VERSION: str = os.environ.get("APP_VERSION", "2.0.0")
    GIT_COMMIT_SHA: str = os.environ.get("GIT_COMMIT_SHA", "HEAD")

    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-only-kshetra-secret-key-change-in-prod-32b")
    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES_MIN: int = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES_MIN", "30"))
    JWT_REFRESH_TOKEN_EXPIRES_DAYS: int = int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "7"))

    # Database
    SQLALCHEMY_DATABASE_URI: str = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{(BACKEND_DIR / 'kshetra.db').as_posix()}",
    )

    # Operational limits
    MAX_FARMERS: int = int(os.environ.get("MAX_FARMERS", "20"))
    MAX_PARCELS_PER_FARMER: int = int(os.environ.get("MAX_PARCELS_PER_FARMER", "4"))
    LOGIN_LOCKOUT_ATTEMPTS: int = int(os.environ.get("LOGIN_LOCKOUT_ATTEMPTS", "5"))
    LOGIN_LOCKOUT_MINUTES: int = int(os.environ.get("LOGIN_LOCKOUT_MINUTES", "15"))

    # CORS
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000",
        ).split(",")
        if origin.strip()
    ]

    # External APIs & AI Assistant Provider
    ASSISTANT_PROVIDER: str = os.environ.get("ASSISTANT_PROVIDER", "auto")
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "llama3.1")
    AGMARKNET_API_KEY: str = os.environ.get("AGMARKNET_API_KEY", os.environ.get("DATA_GOV_IN_API_KEY", ""))

    # Assistant quotas & retention
    ASSISTANT_HOURLY_MSG_LIMIT: int = int(os.environ.get("ASSISTANT_HOURLY_MSG_LIMIT", "30"))
    ASSISTANT_DAILY_TOKEN_BUDGET: int = int(os.environ.get("ASSISTANT_DAILY_TOKEN_BUDGET", "25000"))
    ASSISTANT_RETENTION_DAYS: int = int(os.environ.get("ASSISTANT_RETENTION_DAYS", "90"))

    # Support contact (optional; configured via environment variable only)
    SUPPORT_CONTACT: str = os.environ.get("SUPPORT_CONTACT", "")

    DEBUG: bool = False
    TESTING: bool = False


class DevelopmentConfig(BaseConfig):
    DEBUG: bool = True
    APP_ENV: str = "development"


class TestingConfig(BaseConfig):
    TESTING: bool = True
    DEBUG: bool = True
    APP_ENV: str = "testing"
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///:memory:"
    SECRET_KEY: str = "test-secret-key-for-kshetra-automated-suite-32bytes"
    JWT_SECRET_KEY: str = "test-jwt-secret-key-for-kshetra-automated-suite-32"


class ProductionConfig(BaseConfig):
    DEBUG: bool = False
    TESTING: bool = False
    APP_ENV: str = "production"

    @classmethod
    def validate_production(cls) -> None:
        secret = os.environ.get("SECRET_KEY", "")
        jwt_secret = os.environ.get("JWT_SECRET_KEY", "")
        if not secret or secret.startswith("dev-only") or len(secret) < 32:
            raise RuntimeError(
                "FATAL: Production requires SECRET_KEY environment variable of at least 32 characters."
            )
        if not jwt_secret or jwt_secret.startswith("dev-only") or len(jwt_secret) < 32:
            raise RuntimeError(
                "FATAL: Production requires JWT_SECRET_KEY environment variable of at least 32 characters."
            )


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(env_name: str | None = None) -> type[BaseConfig]:
    name = (env_name or os.environ.get("FLASK_ENV") or "development").lower()
    return CONFIG_BY_NAME.get(name, DevelopmentConfig)
