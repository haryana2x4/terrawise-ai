"""Synthetic test fixtures for Kshetra automated test suite (isolated to backend/tests/)."""
from __future__ import annotations

from pathlib import Path
import sys
import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import create_app
from app.extensions import Base, db_manager, rate_limiter
from app.repositories import FarmerRepository
from app.security import hash_password


@pytest.fixture()
def app():
    rate_limiter.reset()
    application = create_app(
        "testing",
        test_config={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "MAX_FARMERS": 20,
            "ASSISTANT_HOURLY_MSG_LIMIT": 5,
        },
    )
    with application.app_context():
        Base.metadata.drop_all(bind=db_manager.engine)
        Base.metadata.create_all(bind=db_manager.engine)
        yield application


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_token(app, client) -> str:
    with db_manager.session_scope() as session:
        FarmerRepository.create_or_update_admin(
            session,
            farmer_id="ADMIN",
            name="Test Agricultural Officer",
            password_hash=hash_password("Test-Admin-Strong-99!"),
        )
    resp = client.post(
        "/api/v1/auth/login",
        json={"farmer_id": "ADMIN", "password": "Test-Admin-Strong-99!"},
    )
    assert resp.status_code == 200
    return resp.get_json()["access_token"]
