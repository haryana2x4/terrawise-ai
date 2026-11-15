"""WSGI entry point for Kshetra backend server (Gunicorn / Waitress / Flask CLI)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "127.0.0.1")
    flask_env = os.environ.get("FLASK_ENV", "development").lower()
    use_waitress = os.environ.get("SERVE_WAITRESS", "0") == "1" or flask_env == "production"

    if use_waitress:
        try:
            from waitress import serve

            print(f"[WSGI] Serving Kshetra via Waitress on http://{host}:{port}", flush=True)
            serve(app, host=host, port=port, threads=8)
            raise SystemExit(0)
        except ImportError:
            pass

    debug = flask_env == "development"
    use_reloader = (
        debug
        and ("debugpy" not in sys.modules)
        and os.environ.get("KSHETRA_NO_RELOADER") != "1"
    )
    app.run(host=host, port=port, debug=debug, use_reloader=use_reloader)
