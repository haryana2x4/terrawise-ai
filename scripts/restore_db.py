"""Windows-safe SQLite database restore utility."""
from __future__ import annotations

import shutil
import sqlite3
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/restore_db.py <path-to-backup.db> [target-db-path]")
        return 1

    repo_root = Path(__file__).resolve().parent.parent
    backup_file = Path(sys.argv[1]).resolve()
    target_db = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else (repo_root / "backend" / "kshetra.db")

    if not backup_file.exists():
        print(f"[ERROR] Backup file does not exist: {backup_file}")
        return 1

    # Verify SQLite integrity before restoring
    conn = sqlite3.connect(str(backup_file))
    check = conn.execute("PRAGMA integrity_check;").fetchone()
    conn.close()
    if not check or check[0] != "ok":
        print(f"[ERROR] Backup integrity check failed: {check}")
        return 1

    target_db.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(backup_file), str(target_db))
    print(f"[OK] Restored {backup_file} -> {target_db} (integrity_check=ok)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
