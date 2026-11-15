#!/usr/bin/env python3
"""Optional full offline server+UI PyInstaller bundler for Kshetra-Standalone.exe.

Requires: pip install pyinstaller
Creates a self-contained desktop binary bundling Waitress, Flask, SQLAlchemy,
agronomic datasets, and the built React PWA frontend (dist/).
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PKG_DIR = Path(__file__).resolve().parent


def main() -> int:
    pyinstaller = shutil.which("pyinstaller")
    if not pyinstaller:
        print(
            "PyInstaller is not installed. Run `pip install pyinstaller` and retry, "
            "or run `python packaging/windows/build_exe.py` for the lightweight desktop .exe.",
            file=sys.stderr,
        )
        return 1

    dist_dir = ROOT / "frontend" / "dist"
    if not dist_dir.is_dir():
        print("Build the frontend first: cd frontend && npm run build", file=sys.stderr)
        return 1

    icon_arg = []
    ico_path = PKG_DIR / "kshetra.ico"
    if ico_path.is_file():
        icon_arg = [f"--icon={ico_path}"]

    cmd = [
        pyinstaller,
        "--noconfirm",
        "--onefile",
        "--name=Kshetra-Standalone",
        f"--distpath={ROOT / 'release'}",
        f"--add-data={ROOT / 'frontend' / 'dist'};frontend/dist",
        f"--add-data={ROOT / 'data'};data",
        "--hidden-import=waitress",
        "--hidden-import=argon2",
        *icon_arg,
        str(ROOT / "start.py"),
    ]
    print("Running:", " ".join(cmd))
    return subprocess.run(cmd, cwd=str(ROOT)).returncode


if __name__ == "__main__":
    raise SystemExit(main())
