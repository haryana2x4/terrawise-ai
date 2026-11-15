"""Core utilities: standardized errors, JSON logging, null-safe telemetry formatting, pagination, and unit conversion."""
from __future__ import annotations

import hashlib
import json
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from flask import Response, g, jsonify

SQM_PER_ACRE = 4046.8564224
GUNTHAS_PER_ACRE = 40.0
SQM_PER_GUNTHA = SQM_PER_ACRE / GUNTHAS_PER_ACRE  # 101.17141056 sqm
SQM_PER_HECTARE = 10000.0


class AppError(Exception):
    """Domain exception carrying an HTTP status code, machine-readable code, and details."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def get_request_id() -> str:
    try:
        return getattr(g, "request_id", None) or uuid.uuid4().hex[:16]
    except RuntimeError:
        return uuid.uuid4().hex[:16]


def error_response(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None,
) -> Tuple[Response, int]:
    """Build standardized JSON error envelope: { error: { code, message, request_id, details } }."""
    req_id = get_request_id()
    payload = {
        "error": {
            "code": code,
            "message": message,
            "request_id": req_id,
            "details": details or {},
        },
        "message": message,
        "code": code,
    }
    resp = jsonify(payload)
    resp.headers["X-Request-Id"] = req_id
    return resp, status_code


class JsonLogFormatter(logging.Formatter):
    """Structured JSON log formatter with request_id correlation."""

    def format(self, record: logging.LogRecord) -> str:
        log_record: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        try:
            req_id = getattr(g, "request_id", None)
            if req_id:
                log_record["request_id"] = req_id
        except RuntimeError:
            pass
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record, ensure_ascii=False)


def configure_logging(debug: bool = False) -> None:
    root = logging.getLogger()
    level = logging.DEBUG if debug else logging.INFO
    root.setLevel(level)
    if not any(isinstance(h.formatter, JsonLogFormatter) for h in root.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(JsonLogFormatter())
        root.handlers = [handler]


def safe_value(
    value: Optional[float | int],
    unit: str = "",
    decimals: int = 1,
) -> Dict[str, Any]:
    """Enforce Ground Rule G2 (Missing != Zero): null renders 'No data', 0 renders '0 <unit>'."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return {
            "value": None,
            "unit": unit,
            "display": "No data",
            "display_mr": "माहिती नाही",
            "display_hi": "कोई जानकारी नहीं",
            "available": False,
        }
    rounded = round(float(value), decimals) if decimals > 0 else int(round(float(value)))
    suffix = f" {unit}".rstrip()
    text = f"{rounded}{suffix}"
    return {
        "value": rounded,
        "unit": unit,
        "display": text,
        "display_mr": text,
        "display_hi": text,
        "available": True,
    }


def format_provenance(
    source_name: str,
    fetched_at: Optional[datetime | str],
    stale: bool = False,
) -> Dict[str, Any]:
    """Attach data source and timestamp provenance to every metric."""
    if isinstance(fetched_at, datetime):
        iso_ts = fetched_at.astimezone(timezone.utc).isoformat()
        human_date = fetched_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    elif isinstance(fetched_at, str) and fetched_at:
        iso_ts = fetched_at
        human_date = fetched_at[:16].replace("T", " ") + " UTC"
    else:
        iso_ts = None
        human_date = "Unknown time"

    label = (
        f"Old data from {human_date} ({source_name})"
        if stale
        else f"Source: {source_name} · Updated {human_date}"
    )
    return {
        "source": source_name,
        "fetched_at": iso_ts,
        "stale": stale,
        "label": label,
    }


def paginate_list(items: List[Any], page: int = 1, per_page: int = 20) -> Dict[str, Any]:
    page = max(1, int(page))
    per_page = max(1, min(100, int(per_page)))
    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page
    return {
        "items": items[start:end],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": max(1, math.ceil(total / per_page)),
        },
    }


def compute_etag(payload_bytes: bytes | str) -> str:
    raw = payload_bytes.encode("utf-8") if isinstance(payload_bytes, str) else payload_bytes
    return f'"{hashlib.sha256(raw).hexdigest()[:24]}"'


def sqm_to_acres(area_sqm: float) -> float:
    return round(float(area_sqm) / SQM_PER_ACRE, 3)


def sqm_to_gunthas(area_sqm: float) -> float:
    return round(float(area_sqm) / SQM_PER_GUNTHA, 2)


def sqm_to_hectares(area_sqm: float) -> float:
    return round(float(area_sqm) / SQM_PER_HECTARE, 4)
