"""Unified local launcher for Kshetra (works from VS Code, Antigravity IDE, and terminal).

Bootstraps environment variables and dependencies if needed, starts the Flask API
backend and Vite React frontend together, streams unified logs, and opens the browser.
"""
from __future__ import annotations

import argparse
import os
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from typing import List, Optional

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def _log(tag: str, message: str) -> None:
    print(f"[{tag}] {message}", flush=True)


def _is_port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def _find_listening_pids(port: int) -> List[int]:
    """Return PIDs currently listening on TCP `port` without external Python dependencies."""
    pids: List[int] = []
    if sys.platform == "win32":
        try:
            res = subprocess.run(
                ["netstat", "-ano", "-p", "TCP"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            suffix = f":{port}"
            for line in res.stdout.splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[0].upper() == "TCP" and parts[3].upper() == "LISTENING":
                    if parts[1].endswith(suffix) and parts[4].isdigit():
                        pid = int(parts[4])
                        if pid > 0 and pid not in pids:
                            pids.append(pid)
        except Exception:
            pass
    else:
        try:
            res = subprocess.run(
                ["lsof", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            for token in res.stdout.split():
                if token.isdigit():
                    pid = int(token)
                    if pid > 0 and pid not in pids:
                        pids.append(pid)
        except Exception:
            pass
    return pids


def _get_process_cmdline(pid: int) -> str:
    if sys.platform == "win32":
        try:
            res = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine",
                ],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            return res.stdout.strip()
        except Exception:
            return ""
    try:
        cmdline_file = Path(f"/proc/{pid}/cmdline")
        if cmdline_file.is_file():
            return cmdline_file.read_bytes().replace(b"\x00", b" ").decode("utf-8", errors="ignore")
    except Exception:
        pass
    return ""


def _is_kshetra_port_process(host: str, port: int, pid: int) -> bool:
    """Confirm TCP listener on `port` belongs to Kshetra backend/frontend before auto-reclaiming."""
    cmdline = _get_process_cmdline(pid).lower()
    markers = ("terrawise-ai", "kshetra", "wsgi.py", "start.py", "vite")
    if any(m in cmdline for m in markers):
        return True
    try:
        with urllib.request.urlopen(f"http://{host}:{port}/api/v1/meta/version", timeout=1.0) as resp:
            if 200 <= resp.status < 500 and b"kshetra" in resp.read().lower():
                return True
    except Exception:
        pass
    return False


def _ensure_port_available(host: str, port: int) -> bool:
    """Ensure `port` is free, automatically stopping an older Kshetra server instance if present."""
    if not _is_port_in_use(host, port):
        return True

    pids = _find_listening_pids(port)
    reclaimed = False
    for pid in pids:
        if pid == os.getpid():
            continue
        if _is_kshetra_port_process(host, port, pid):
            _log("RECLAIM", f"Stopping previous Kshetra process on port {port} (PID {pid})...")
            if sys.platform == "win32":
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
            else:
                try:
                    os.kill(pid, signal.SIGTERM)
                except OSError:
                    pass
            reclaimed = True

    if reclaimed:
        deadline = time.monotonic() + 4.0
        while time.monotonic() < deadline:
            if not _is_port_in_use(host, port):
                return True
            time.sleep(0.2)

    return not _is_port_in_use(host, port)


def ensure_env_file() -> None:
    """Create root .env from .env.example with fresh cryptographic keys if missing."""
    env_path = ROOT_DIR / ".env"
    example_path = ROOT_DIR / ".env.example"
    if env_path.exists() or not example_path.exists():
        return

    lines: List[str] = []
    for raw_line in example_path.read_text(encoding="utf-8").splitlines():
        if raw_line.startswith("SECRET_KEY=replace-with-"):
            lines.append(f"SECRET_KEY={secrets.token_urlsafe(36)}")
        elif raw_line.startswith("JWT_SECRET_KEY=replace-with-"):
            lines.append(f"JWT_SECRET_KEY={secrets.token_urlsafe(36)}")
        else:
            lines.append(raw_line)

    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    _log("SETUP", "Created .env with freshly generated local security keys.")


def ensure_backend_dependencies() -> None:
    """Install backend Python requirements if core packages are not yet available."""
    required_modules = ("flask", "sqlalchemy", "cryptography", "reportlab", "requests")
    missing = []
    for mod in required_modules:
        try:
            __import__(mod)
        except ImportError:
            missing.append(mod)

    if not missing:
        return

    req_file = BACKEND_DIR / "requirements.txt"
    _log("SETUP", f"Installing missing backend packages ({', '.join(missing)})...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(req_file)],
        cwd=str(BACKEND_DIR),
        check=True,
    )


def find_npm_executable() -> Optional[str]:
    if sys.platform == "win32":
        return shutil.which("npm.cmd") or shutil.which("npm")
    return shutil.which("npm")


def ensure_frontend_dependencies() -> Optional[str]:
    """Install frontend npm packages when node_modules/vite is missing."""
    npm_exe = find_npm_executable()
    if not npm_exe:
        return None

    vite_bin = (
        FRONTEND_DIR / "node_modules" / ".bin" / ("vite.cmd" if sys.platform == "win32" else "vite")
    )
    if vite_bin.exists():
        return npm_exe

    _log("SETUP", "Installing frontend npm dependencies (first run)...")
    subprocess.run([npm_exe, "install"], cwd=str(FRONTEND_DIR), check=True)
    return npm_exe


def ensure_database_initialized() -> int:
    """Validate backend configuration, initialize SQLite tables, and count active admins."""
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    from sqlalchemy import text
    from app import create_app
    from app.extensions import db_manager

    create_app()
    with db_manager.session_scope() as session:
        count = session.execute(
            text("SELECT COUNT(*) FROM farmers WHERE role = 'admin' AND deleted_at IS NULL")
        ).scalar()
    return int(count or 0)


def _stream_process_output(proc: subprocess.Popen[str], prefix: str) -> None:
    if proc.stdout is None:
        return
    try:
        for line in proc.stdout:
            text_line = line.rstrip("\r\n")
            if text_line:
                _log(prefix, text_line)
    except Exception:
        pass


def _terminate_process_tree(proc: Optional[subprocess.Popen[str]], label: str) -> None:
    if proc is None or proc.poll() is not None:
        return
    _log("STOP", f"Stopping {label} (PID {proc.pid})...")
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            proc.terminate()
            proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def _wait_for_http(url: str, timeout_seconds: float, proc: subprocess.Popen[str]) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=1.5) as resp:
                if 200 <= resp.status < 500:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.35)
    return False


def _get_lan_ips() -> List[str]:
    ips: List[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            primary = s.getsockname()[0]
            if primary and not primary.startswith("127."):
                ips.append(primary)
    except OSError:
        pass
    return ips


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Kshetra backend and frontend locally.")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open a web browser automatically after startup.",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Bootstrap .env, verify dependencies and database initialization, then exit.",
    )
    parser.add_argument(
        "--share",
        action="store_true",
        help="Bind servers on 0.0.0.0 and display Wi-Fi LAN share URLs for phones and tablets.",
    )
    parser.add_argument(
        "--prod",
        action="store_true",
        help="Build frontend bundle if needed and serve the full PWA + API on single port 5000 via Waitress.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--backend-port", type=int, default=5000, help="Backend port (default: 5000)")
    parser.add_argument("--frontend-port", type=int, default=5173, help="Frontend port (default: 5173)")
    args = parser.parse_args(argv)
    if args.share:
        args.host = "0.0.0.0"
    return args


def main(argv: List[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])

    _log("KSHETRA", f"Project root: {ROOT_DIR}")
    ensure_env_file()
    ensure_backend_dependencies()
    npm_exe = ensure_frontend_dependencies()
    if not npm_exe:
        _log("ERROR", "Node.js / npm was not found on PATH. Install Node.js 20+ and re-run.")
        return 1

    admin_count = ensure_database_initialized()
    if admin_count == 0:
        _log(
            "NOTICE",
            "No administrator account exists yet. Create one in a terminal: "
            "cd backend && python -m flask --app wsgi create-admin --admin-id ADMIN",
        )
    else:
        _log("READY", f"Database initialized ({admin_count} active administrator account(s)).")

    if args.check_only:
        _log("READY", "Bootstrap check completed successfully.")
        return 0

    probe_host = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host

    if not _ensure_port_available(probe_host, args.backend_port):
        _log(
            "ERROR",
            f"Port {args.backend_port} is in use by another application on {probe_host}. Close it and retry.",
        )
        return 1

    if not args.prod and not _ensure_port_available(probe_host, args.frontend_port):
        _log(
            "ERROR",
            f"Port {args.frontend_port} is in use by another application on {probe_host}. Close it and retry.",
        )
        return 1

    if args.prod:
        dist_index = FRONTEND_DIR / "dist" / "index.html"
        if not dist_index.exists():
            _log("BUILD", "Building frontend production PWA bundle (frontend/dist)...")
            subprocess.run([npm_exe, "run", "build"], cwd=str(FRONTEND_DIR), check=True)

    backend_env = os.environ.copy()
    backend_env.update(
        {
            "PYTHONUNBUFFERED": "1",
            "PYTHONIOENCODING": "utf-8",
            "HOST": args.host,
            "PORT": str(args.backend_port),
            "FLASK_ENV": backend_env.get("FLASK_ENV", "development"),
            "SERVE_WAITRESS": "1" if args.prod else backend_env.get("SERVE_WAITRESS", "0"),
            "ALLOW_LAN_ORIGINS": "1" if args.share else backend_env.get("ALLOW_LAN_ORIGINS", "1"),
            "KSHETRA_NO_RELOADER": "1",
        }
    )

    frontend_env = os.environ.copy()
    frontend_env.setdefault("BROWSER", "none")

    backend_proc: Optional[subprocess.Popen[str]] = None
    frontend_proc: Optional[subprocess.Popen[str]] = None
    stopping = False

    def handle_signal(signum: int, _frame: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    try:
        server_kind = "Waitress PWA+API" if args.prod else "Flask backend"
        _log("START", f"Launching {server_kind} on http://{args.host}:{args.backend_port} ...")
        backend_proc = subprocess.Popen(
            [sys.executable, str(BACKEND_DIR / "wsgi.py")],
            cwd=str(BACKEND_DIR),
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        threading.Thread(
            target=_stream_process_output, args=(backend_proc, "API"), daemon=True
        ).start()

        health_url = f"http://{probe_host}:{args.backend_port}/healthz"
        if not _wait_for_http(health_url, timeout_seconds=30.0, proc=backend_proc):
            _log("ERROR", "Backend API failed to become healthy within 30 seconds.")
            return 1

        if args.prod:
            app_url = f"http://{probe_host}:{args.backend_port}"
            active_port = args.backend_port
        else:
            _log("START", f"Launching Vite frontend on http://{args.host}:{args.frontend_port} ...")
            frontend_proc = subprocess.Popen(
                [
                    npm_exe,
                    "run",
                    "dev",
                    "--",
                    "--host",
                    args.host,
                    "--port",
                    str(args.frontend_port),
                    "--strictPort",
                ],
                cwd=str(FRONTEND_DIR),
                env=frontend_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
            threading.Thread(
                target=_stream_process_output, args=(frontend_proc, "WEB"), daemon=True
            ).start()

            app_url = f"http://{probe_host}:{args.frontend_port}"
            active_port = args.frontend_port
            if not _wait_for_http(app_url, timeout_seconds=30.0, proc=frontend_proc):
                _log("ERROR", "Frontend Vite dev server failed to start within 30 seconds.")
                return 1

        lan_ips = _get_lan_ips() if args.share else []
        print("\n" + "=" * 64, flush=True)
        print(f"  Kshetra App      : {app_url}", flush=True)
        print(f"  Backend API      : http://{probe_host}:{args.backend_port}", flush=True)
        print(f"  Health Probe     : {health_url}", flush=True)
        for lip in lan_ips:
            print(f"  Wi-Fi / Phone URL: http://{lip}:{active_port}", flush=True)
        if args.share:
            print(f"  Public HTTPS Tip : cloudflared tunnel --url http://127.0.0.1:{active_port}", flush=True)
        print("  Press Ctrl+C (or Stop in IDE) to shut down cleanly.", flush=True)
        print("=" * 64 + "\n", flush=True)

        no_browser = args.no_browser or os.environ.get("KSHETRA_NO_BROWSER") == "1"
        if not no_browser:
            webbrowser.open(app_url)

        while not stopping:
            if backend_proc.poll() is not None:
                _log("ERROR", f"Backend process exited unexpectedly (code {backend_proc.returncode}).")
                return backend_proc.returncode or 1
            if frontend_proc is not None and frontend_proc.poll() is not None:
                _log("ERROR", f"Frontend process exited unexpectedly (code {frontend_proc.returncode}).")
                return frontend_proc.returncode or 1
            time.sleep(0.5)

        return 0
    finally:
        _terminate_process_tree(frontend_proc, "Vite frontend")
        _terminate_process_tree(backend_proc, "Flask backend")
        _log("STOP", "Kshetra stopped cleanly.")


if __name__ == "__main__":
    raise SystemExit(main())
