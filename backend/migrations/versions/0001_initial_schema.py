"""Initial production schema for Kshetra (zero demo columns, encrypted PII, DPDP consent, assistant & audit logs).

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-11-15
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.extensions import Base
    import app.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.extensions import Base
    import app.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
