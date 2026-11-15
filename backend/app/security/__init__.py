"""Security module: Argon2id/PBKDF2 hashing, authenticated PII encryption, HMAC-SHA256 JWT tokens, RBAC, and security headers."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable, Dict, Optional

from flask import Response, current_app, g, request
from werkzeug.security import check_password_hash, generate_password_hash

from app.core import AppError

try:
    from argon2 import PasswordHasher

    _argon2_hasher: Optional[Any] = PasswordHasher(
        time_cost=2, memory_cost=32768, parallelism=2
    )
except ImportError:
    _argon2_hasher = None

NATURE_WORDS = [
    "Banyan", "Peepal", "Neem", "Lotus", "Godavari", "Pravara", "Sahyadri", "Monsoon",
    "Millet", "Saffron", "Turmeric", "Cardamom", "Tamarind", "Pomegranate", "Guava", "Bamboo",
    "Falcon", "Peacock", "Sparrow", "Swallow", "Granite", "Basalt", "Quartz", "Amber",
    "Meadow", "Valleys", "Orchard", "Harvest", "Sunrise", "Lantern", "Breeze", "Stream",
]


def hash_password(cleartext: str) -> str:
    """Hash password with Argon2id (when available) or OWASP PBKDF2-HMAC-SHA256 (600,000 iterations)."""
    if _argon2_hasher is not None:
        return _argon2_hasher.hash(cleartext)
    return generate_password_hash(cleartext, method="pbkdf2:sha256:600000", salt_length=16)


def verify_password(cleartext: str, password_hash: str) -> bool:
    """Verify password against Argon2id or PBKDF2 hash."""
    if not cleartext or not password_hash:
        return False
    if password_hash.startswith("$argon2") and _argon2_hasher is not None:
        try:
            return bool(_argon2_hasher.verify(password_hash, cleartext))
        except Exception:
            return False
    try:
        return check_password_hash(password_hash, cleartext)
    except Exception:
        return False


def generate_natural_password() -> str:
    """Generate a pronounceable, high-entropy (~40-bit) password: Word1-Word2-Word3-NN."""
    w1 = secrets.choice(NATURE_WORDS)
    w2 = secrets.choice(NATURE_WORDS)
    w3 = secrets.choice(NATURE_WORDS)
    digits = f"{secrets.randbelow(90) + 10:02d}"
    return f"{w1}-{w2}-{w3}-{digits}"


def generate_farmer_id(prefix: str = "KS") -> str:
    """Generate a clean, readable Farmer ID such as KS-482910."""
    num = secrets.randbelow(900000) + 100000
    return f"{prefix}-{num}"


def _derive_enc_mac_keys(secret_key: str) -> tuple[bytes, bytes]:
    enc_k = hashlib.sha256(f"kshetra:enc:{secret_key}".encode("utf-8")).digest()
    mac_k = hashlib.sha256(f"kshetra:mac:{secret_key}".encode("utf-8")).digest()
    return enc_k, mac_k


def _ctr_keystream_xor(data: bytes, key: bytes, nonce: bytes) -> bytes:
    out = bytearray(len(data))
    block = 0
    offset = 0
    while offset < len(data):
        digest = hashlib.sha256(key + nonce + block.to_bytes(4, "big")).digest()
        take = min(32, len(data) - offset)
        for i in range(take):
            out[offset + i] = data[offset + i] ^ digest[i]
        offset += take
        block += 1
    return bytes(out)


def encrypt_field(plaintext: Optional[str], secret_key: str) -> Optional[str]:
    """Authenticated encryption (Encrypt-then-MAC with SHA-256 CTR + HMAC-SHA256) for PII at rest."""
    if not plaintext:
        return None
    enc_k, mac_k = _derive_enc_mac_keys(secret_key)
    nonce = secrets.token_bytes(12)
    pt_bytes = plaintext.strip().encode("utf-8")
    ct_bytes = _ctr_keystream_xor(pt_bytes, enc_k, nonce)
    tag = hmac.new(mac_k, nonce + ct_bytes, hashlib.sha256).digest()[:16]
    blob = base64.urlsafe_b64encode(nonce + tag + ct_bytes).decode("ascii")
    return f"enc:v1:{blob}"


def decrypt_field(ciphertext: Optional[str], secret_key: str) -> Optional[str]:
    """Verify HMAC tag and decrypt sensitive PII field."""
    if not ciphertext:
        return None
    if not ciphertext.startswith("enc:v1:"):
        return ciphertext
    enc_k, mac_k = _derive_enc_mac_keys(secret_key)
    try:
        raw = base64.urlsafe_b64decode(ciphertext[7:].encode("ascii"))
        nonce, tag, ct_bytes = raw[:12], raw[12:28], raw[28:]
        expected = hmac.new(mac_k, nonce + ct_bytes, hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(tag, expected):
            return None
        pt_bytes = _ctr_keystream_xor(ct_bytes, enc_k, nonce)
        return pt_bytes.decode("utf-8")
    except Exception:
        return None


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode((s + pad).encode("ascii"))


def create_access_token(
    farmer_id: str,
    role: str,
    secret_key: str,
    expires_minutes: int = 30,
) -> str:
    """Create a standard RFC 7519 HS256 JWT token."""
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": farmer_id,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + int(expires_minutes * 60),
        "jti": secrets.token_hex(8),
    }
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{h_b64}.{p_b64}.{_b64url_encode(sig)}"


def verify_access_token(token: str, secret_key: str) -> Dict[str, Any]:
    """Verify RFC 7519 HS256 JWT signature and expiration."""
    parts = (token or "").split(".")
    if len(parts) != 3:
        raise AppError("INVALID_TOKEN", "Invalid authentication token format.", 401)
    h_b64, p_b64, sig_b64 = parts
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    expected_sig = _b64url_encode(
        hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    )
    if not hmac.compare_digest(sig_b64, expected_sig):
        raise AppError("INVALID_TOKEN", "Invalid authentication token signature.", 401)
    try:
        payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    except Exception as exc:
        raise AppError("INVALID_TOKEN", "Malformed token payload.", 401) from exc

    if payload.get("type") != "access":
        raise AppError("INVALID_TOKEN_TYPE", "Expected an access token.", 401)
    if int(time.time()) > int(payload.get("exp", 0)):
        raise AppError("TOKEN_EXPIRED", "Access token has expired. Please refresh or log in again.", 401)
    return payload


def generate_refresh_token_raw() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def extract_bearer_token() -> str:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    cookie_token = request.cookies.get("kshetra_access")
    if cookie_token:
        return cookie_token.strip()
    raise AppError("AUTHENTICATION_REQUIRED", "Missing Authorization Bearer token.", 401)


def require_auth(role: Optional[str] = None) -> Callable[..., Any]:
    """Decorator enforcing JWT authentication and optional role ('admin' or 'farmer')."""

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            raw_token = extract_bearer_token()
            jwt_secret = current_app.config["JWT_SECRET_KEY"]
            claims = verify_access_token(raw_token, jwt_secret)
            g.current_farmer_id = claims["sub"]
            g.current_role = claims.get("role", "farmer")

            if role is not None and g.current_role != role:
                raise AppError(
                    "FORBIDDEN",
                    f"Access denied. Required role: '{role}'.",
                    403,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def check_object_ownership(owner_farmer_id: str) -> None:
    """Enforce object-level authorization (IDOR protection): farmer can only access their own records unless admin."""
    current_id = getattr(g, "current_farmer_id", None)
    current_role = getattr(g, "current_role", None)
    if current_role == "admin":
        return
    if not current_id or current_id != owner_farmer_id:
        raise AppError(
            "FORBIDDEN_OWNERSHIP",
            "You do not have permission to access or modify another farmer's resources.",
            403,
        )


def apply_security_headers(response: Response) -> Response:
    """Attach hardened HTTP security headers to every response."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(self), camera=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://maps.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://*.tile.opentopomap.org https://*.googleapis.com https://*.gstatic.com https://gibs.earthdata.nasa.gov; "
        "worker-src 'self' blob:; "
        "manifest-src 'self'; "
        "connect-src 'self' https://api.open-meteo.com https://power.larc.nasa.gov https://rest.isric.org;"
    )
    req_id = getattr(g, "request_id", None)
    if req_id:
        response.headers["X-Request-Id"] = req_id
    return response
