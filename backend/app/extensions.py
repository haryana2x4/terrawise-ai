"""Database session management, rate limiting, and TTL caching extensions."""
from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from typing import Any, Dict, Generator, Optional, Tuple

from flask import Flask
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    """Declarative base for all Kshetra SQLAlchemy models."""


def _configure_sqlite_pragmas(dbapi_connection: Any, _connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=5000;")
    cursor.close()


class DatabaseManager:
    """Thread-safe SQLAlchemy engine & session factory."""

    def __init__(self) -> None:
        self.engine: Optional[Engine] = None
        self.session_factory: Optional[sessionmaker[Session]] = None

    def init_app(self, app: Flask) -> None:
        uri: str = app.config["SQLALCHEMY_DATABASE_URI"]
        is_sqlite = uri.startswith("sqlite")
        is_memory = ":memory:" in uri

        kwargs: Dict[str, Any] = {"future": True}
        if is_sqlite:
            kwargs["connect_args"] = {"check_same_thread": False, "timeout": 15}
            if is_memory:
                kwargs["poolclass"] = StaticPool

        self.engine = create_engine(uri, **kwargs)
        if is_sqlite:
            event.listen(self.engine, "connect", _configure_sqlite_pragmas)

        self.session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )

    @contextmanager
    def session_scope(self) -> Generator[Session, None, None]:
        if self.session_factory is None:
            raise RuntimeError("DatabaseManager has not been initialized.")
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_session(self) -> Session:
        if self.session_factory is None:
            raise RuntimeError("DatabaseManager has not been initialized.")
        return self.session_factory()

    def ping(self) -> bool:
        if self.engine is None:
            return False
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            return False


class RateLimiter:
    """Thread-safe sliding-window rate limiter."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: Dict[str, list[float]] = {}

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            hits = [t for t in self._buckets.get(key, []) if t > cutoff]
            if len(hits) >= limit:
                retry_after = max(1, int(window_seconds - (now - hits[0])))
                self._buckets[key] = hits
                return False, retry_after
            hits.append(now)
            self._buckets[key] = hits
            return True, 0

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


class TTLCache:
    """Thread-safe in-memory TTL cache."""

    def __init__(self, default_ttl_seconds: int = 900) -> None:
        self._default_ttl = default_ttl_seconds
        self._lock = threading.Lock()
        self._store: Dict[str, Tuple[float, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if now >= expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        with self._lock:
            self._store[key] = (time.monotonic() + ttl, value)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


db_manager = DatabaseManager()
rate_limiter = RateLimiter()
app_cache = TTLCache(default_ttl_seconds=900)
