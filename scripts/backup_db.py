"""Windows-safe online SQLite backup script with 7-snapshot retention."""
from __future__ import annotations

import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    db_path = Path(sys.argv[1]) if len(sys.argv) > 1 else (repo_root / "backend" / "kshetra.db")
    backup_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else (repo_root / "backups")

    if not db_path.exists():
        print(f"[WARN] Database file not found at {db_path}")
        return 1

    backup_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dest = backup_dir / f"kshetra_backup_{ts}.db"

    src = sqlite3.connect(str(db_path))
    dst = sqlite3.connect(str(dest))
    with dst:
        src.backup(dst)
    dst.close()
    src.close()

    snapshots = sorted(backup_dir.glob("kshetra_backup_*.db"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in snapshots[7:]:
        old.unlink(missing_ok=True)

    print(f"[OK] Created backup at {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
