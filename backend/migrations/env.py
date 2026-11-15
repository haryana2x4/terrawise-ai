"""Alembic migration environment for Kshetra SQLAlchemy models."""
from __future__ import annotations

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import get_config
from app.extensions import Base
import app.models  # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    cfg = get_config()
    context.configure(
        url=cfg.SQLALCHEMY_DATABASE_URI,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = get_config()
    connectable = engine_from_config(
        {"sqlalchemy.url": cfg.SQLALCHEMY_DATABASE_URI},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
