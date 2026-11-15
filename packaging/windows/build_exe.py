#!/usr/bin/env python3
"""Compile the native Windows Kshetra-Desktop.exe launcher with custom app icon."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
PKG_DIR = Path(__file__).resolve().parent
ICON_PNG = ROOT / "frontend" / "public" / "icons" / "icon-192.png"
ICON_ICO = PKG_DIR / "kshetra.ico"
CS_SOURCE = PKG_DIR / "KshetraDesktop.cs"
OUTPUT_DIR = ROOT / "release"
OUTPUT_EXE = OUTPUT_DIR / "Kshetra-Desktop.exe"


def find_csc() -> Path:
    candidates = [
        Path(r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
        Path(r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"),
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    found = shutil.which("csc")
    if found:
        return Path(found)
    raise FileNotFoundError("Microsoft .NET csc.exe compiler was not found on this machine.")


def build_ico() -> Path | None:
    if not ICON_PNG.is_file():
        return None
    with Image.open(ICON_PNG) as img:
        rgba = img.convert("RGBA")
        rgba.save(
            ICON_ICO,
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )
    return ICON_ICO


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    csc = find_csc()
    ico = build_ico()

    cmd = [
        str(csc),
        "/nologo",
        "/optimize+",
        "/target:winexe",
        f"/out:{OUTPUT_EXE}",
        "/reference:System.dll",
        "/reference:System.Windows.Forms.dll",
    ]
    if ico and ico.is_file():
        cmd.append(f"/win32icon:{ico}")
    cmd.append(str(CS_SOURCE))

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write(res.stdout + "\n" + res.stderr + "\n")
        return res.returncode

    header = OUTPUT_EXE.read_bytes()[:2]
    if header != b"MZ":
        raise RuntimeError(f"Unexpected PE header {header!r} in {OUTPUT_EXE}")

    print(f"Built {OUTPUT_EXE} ({OUTPUT_EXE.stat().st_size:,} bytes, PE header {header!r})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
