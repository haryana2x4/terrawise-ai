"""
TERRAWISE AI - Utilities: Credential Generation, Secure Password Hashing, and Safe Null-vs-Zero Formatting
Supports Argon2id with automatic secure fallback to built-in memory-hard scrypt (RFC 7914)
when system Application Control policies restrict external C-FFI binaries.
"""

import os
import re
import secrets
import hashlib
import hmac
import math
from typing import Dict, Any, Optional, Tuple

# Try loading Argon2id, with automatic fallback to built-in hashlib.scrypt
_USE_ARGON2 = False
try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
    _ph = PasswordHasher(
        time_cost=3,
        memory_cost=65536,
        parallelism=4,
        hash_len=32,
        salt_len=16
    )
    _USE_ARGON2 = True
except Exception:
    _USE_ARGON2 = False

CURATED_WORDS = [
    "Mango", "River", "Tiger", "Apple", "Solar", "Cloud", "Green", "Earth",
    "Field", "Water", "Flora", "Plant", "Grain", "Wheat", "Grass", "Ocean",
    "Grove", "Honey", "Amber", "Breeze", "Clover", "Forest", "Valley", "Harbor",
    "Silver", "Golden", "Lotus", "Tulip", "Orchid", "Bamboo", "Branch", "Cedar",
    "Spring", "Summer", "Autumn", "Winter", "Shadow", "Falcon", "Eagle", "Robin",
    "Pecan", "Walnut", "Acorn", "Melon", "Berry", "Cherry", "Citrus", "Orange",
    "Cobalt", "Copper", "Garnet", "Quartz", "Jasper", "Opal", "Bronze", "Beacon",
    "Anchor", "Bridge", "Castle", "Harbor", "Island", "Meadow", "Prairie", "Timber",
    "Willow", "Spruce", "Birch", "Maple", "Almond", "Ginger", "Pepper", "Cotton",
    "Sesame", "Sorghum", "Millet", "Pigeon", "Crane", "Parrot", "Peacock", "Swan",
    "Canyon", "Lagoon", "Summit", "Plateau", "Stream", "Brook", "Canal", "Geyser",
    "Pebble", "Boulder", "Marble", "Granite", "Basalt", "Shale", "Crystal", "Fossil",
    "Banyan", "Neem", "Teak", "Sal", "Peepal", "Jamun", "Guava", "Papaya",
    "Chili", "Turmeric", "Garlic", "Cumin", "Cardamom", "Fennel", "Mustard", "Clove"
]

def hash_password(plaintext: str) -> str:
    """Hashes password using Argon2id if available, otherwise built-in scrypt (N=16384, r=8, p=1)."""
    if _USE_ARGON2:
        return _ph.hash(plaintext)
    
    salt = os.urandom(16)
    key = hashlib.scrypt(plaintext.encode("utf-8"), salt=salt, n=16384, r=8, p=1, maxmem=32*1024*1024)
    return f"$scrypt$ln=14,r=8,p=1${salt.hex()}${key.hex()}"

def verify_password(hash_str: str, plaintext: str) -> bool:
    """Verifies a plaintext password against Argon2id or scrypt hash."""
    if hash_str.startswith("$argon2id$") and _USE_ARGON2:
        try:
            return _ph.verify(hash_str, plaintext)
        except Exception:
            return False
            
    if hash_str.startswith("$scrypt$"):
        try:
            parts = hash_str.split("$")
            if len(parts) != 5:
                return False
            salt = bytes.fromhex(parts[3])
            expected_key = bytes.fromhex(parts[4])
            computed_key = hashlib.scrypt(plaintext.encode("utf-8"), salt=salt, n=16384, r=8, p=1, maxmem=32*1024*1024)
            return hmac.compare_digest(computed_key, expected_key)
        except Exception:
            return False

    return False

def generate_natural_password() -> str:
    """Generates natural, pronounceable 3-word + 2-digit password (e.g. 'Mango-River-Tiger-47')."""
    w1 = secrets.choice(CURATED_WORDS)
    w2 = secrets.choice(CURATED_WORDS)
    while w2 == w1:
        w2 = secrets.choice(CURATED_WORDS)
    w3 = secrets.choice(CURATED_WORDS)
    while w3 in (w1, w2):
        w3 = secrets.choice(CURATED_WORDS)
    
    digits = secrets.randbelow(89) + 11
    return f"{w1}-{w2}-{w3}-{digits}"

def generate_farmer_id(district: str, serial_num: int) -> str:
    """Generates unambiguous farmer ID (AHN-001 or NSK-001)."""
    d_clean = district.lower().strip()
    prefix = "AHN" if ("ahilya" in d_clean or "ahmed" in d_clean) else "NSK"
    return f"{prefix}-{serial_num:03d}"

def safe_value(val: Any, source: str = "Unknown", observed_at: Optional[str] = None) -> Dict[str, Any]:
    """
    Null-safe telemetry value wrapper:
    - null/None renders 'No data' / 'माहिती नाही'
    - recorded 0 renders '0'
    """
    if val is None or val == "" or (isinstance(val, float) and (val < -900 or math.isnan(val))):
        return {
            "value": None,
            "display": {
                "en": "No data",
                "mr": "माहिती नाही",
                "hi": "कोई जानकारी नहीं"
            },
            "is_missing": True,
            "source": source,
            "observed_at": observed_at
        }
    
    display_str = f"{val:.1f}" if isinstance(val, float) else str(val)
    return {
        "value": val,
        "display": {
            "en": display_str,
            "mr": display_str,
            "hi": display_str
        },
        "is_missing": False,
        "source": source,
        "observed_at": observed_at
    }

def format_provenance(source_label: str, observed_at_str: str, is_stale: bool = False) -> str:
    """Formats data source and observation timestamp."""
    if is_stale:
        return f"Old data from {observed_at_str} (Source: {source_label})"
    return f"Source: {source_label}, updated {observed_at_str}"
