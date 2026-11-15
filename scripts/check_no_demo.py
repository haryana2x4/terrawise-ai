#!/usr/bin/env python3
"""
Production Guard Script (Phase 2.5): scripts/check_no_demo.py
Scans production code (backend/app, backend/wsgi.py, backend/worker.py, frontend/src, frontend/index.html)
and fails with exit code 1 if any forbidden demo/sample/mock/placeholder tokens or hardcoded credentials exist.
"""

import os
import re
import sys

REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

SCAN_DIRS = [
    os.path.join(REPO_ROOT, "backend", "app"),
    os.path.join(REPO_ROOT, "frontend", "src"),
]

SCAN_FILES = [
    os.path.join(REPO_ROOT, "backend", "wsgi.py"),
    os.path.join(REPO_ROOT, "backend", "worker.py"),
    os.path.join(REPO_ROOT, "frontend", "index.html"),
]

EXCLUDE_DIRS = {"__pycache__", "node_modules", "dist", "tests", "__tests__", ".git"}

FORBIDDEN_PATTERNS = [
    (r"\bdemo\b", "forbidden word 'demo'"),
    (r"\bsample\b", "forbidden word 'sample'"),
    (r"\bmock\b", "forbidden word 'mock'"),
    (r"\bdummy\b", "forbidden word 'dummy'"),
    (r"\bfake\b", "forbidden word 'fake'"),
    (r"\blorem\b", "forbidden word 'lorem'"),
    (r"example@", "forbidden placeholder email 'example@'"),
    (r"test@", "forbidden placeholder email 'test@'"),
    (r"password123", "forbidden weak password 'password123'"),
    (r"admin/admin", "forbidden default credential 'admin/admin'"),
    (r"\bjudge\b", "forbidden word 'judge'"),
    (r"\?demo=1", "forbidden demo query param '?demo=1'"),
    (r"\bis_demo\b", "forbidden demo flag 'is_demo'"),
    (r"\bTODO\b", "unfinished marker 'TODO'"),
    (r"\bFIXME\b", "unfinished marker 'FIXME'"),
    (r"console\.log\s*\(", "debug statement 'console.log('"),
    (r"Admin-Secure-Pass", "hard-coded admin password"),
    (r"Mango-River-Tiger", "hard-coded farmer password"),
    (r"Water-Flora-Wheat", "hard-coded farmer password"),
    (r"1800-123-4567", "placeholder toll-free number '1800-123-4567'"),
    (r"needs_native_review", "UI-visible review flag 'needs_native_review'"),
    (r"needs_verification", "UI-visible review flag 'needs_verification'"),
    (r"AIza[0-9A-Za-z\-_]{20,}", "hard-coded Google API key"),
    (r"sk-[0-9A-Za-z]{20,}", "hard-coded OpenAI API key"),
]


def scan_file(filepath: str) -> list[str]:
    violations = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        return violations

    rel_path = os.path.relpath(filepath, REPO_ROOT)
    for line_no, line in enumerate(lines, start=1):
        for pattern, label in FORBIDDEN_PATTERNS:
            if re.search(pattern, line, flags=re.IGNORECASE if "TODO" not in pattern and "FIXME" not in pattern else 0):
                violations.append(f"{rel_path}:{line_no} -> {label}: {line.strip()[:120]}")
    return violations


def main() -> int:
    all_violations: list[str] = []

    for d in SCAN_DIRS:
        if not os.path.exists(d):
            continue
        for root, dirs, files in os.walk(d):
            dirs[:] = [dr for dr in dirs if dr not in EXCLUDE_DIRS]
            for file in files:
                if file.endswith((".py", ".ts", ".tsx", ".js", ".jsx", ".html", ".css")):
                    all_violations.extend(scan_file(os.path.join(root, file)))

    for f in SCAN_FILES:
        if os.path.exists(f):
            all_violations.extend(scan_file(f))

    if all_violations:
        print(f"[FAIL] check_no_demo found {len(all_violations)} violation(s):")
        for v in all_violations:
            print(f"  - {v}")
        return 1

    print("[PASS] check_no_demo: 0 demo/sample/mock/placeholder or secret violations in production code.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
