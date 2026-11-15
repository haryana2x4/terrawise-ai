"""WSGI entry point for Kshetra backend server (Gunicorn / Waitress / Flask CLI)."""
from __future__ import annotations

import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_ENV", "development") == "development"
    app.run(host=host, port=port, debug=debug)
