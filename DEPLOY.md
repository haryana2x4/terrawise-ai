# Production Deployment Guide (`DEPLOY.md`)

## 1. Environment Variables (`.env`)

Copy `.env.example` to `.env` and set strong production secrets (`>= 32` bytes):

```ini
FLASK_ENV=production
SECRET_KEY=<generate-with-python-secrets-token-urlsafe-32>
JWT_SECRET_KEY=<generate-with-python-secrets-token-urlsafe-32>
DATABASE_URL=sqlite:////data/kshetra.db
CORS_ORIGINS=https://kshetra.org.in

# Optional AI Provider & Agmarknet Keys (read from env only)
ASSISTANT_PROVIDER=auto
GEMINI_API_KEY=
OPENAI_API_KEY=
AGMARKNET_API_KEY=
SUPPORT_CONTACT=
```

> **Fail-Fast Guarantee**: In `production` mode (`FLASK_ENV=production`), `ProductionConfig.validate_production()` refuses to boot if `SECRET_KEY` or `JWT_SECRET_KEY` is missing, shorter than 32 characters, or starts with `dev-only`.

---

## 2. Docker Compose Deployment

```powershell
# 1. Build and start the backend API and background telemetry worker
docker compose up -d --build

# 2. Initialize the first Administrator account inside the container
docker exec -it kshetra-backend flask create-admin --admin-id ADMIN --name "District Officer"
```

---

## 3. Reverse Proxy & TLS

- **Caddy (Automatic HTTPS)**: Use [`deploy/Caddyfile`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/deploy/Caddyfile) to serve `frontend/dist` with Zstandard/Gzip compression and proxy `/api/*`, `/healthz`, and `/readyz` to `backend:5000`.
- **Nginx**: Use [`deploy/nginx.conf`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/deploy/nginx.conf).

---

## 4. Database Backups & Restore

- **Automated Worker Backups**: `backend/worker.py` performs an online SQLite backup (`sqlite3.Connection.backup`) every cycle into `./backups/` and retains the 7 most recent snapshots.
- **Manual Backup**:
  ```powershell
  python scripts/backup_db.py
  ```
- **Restore with Integrity Check**:
  ```powershell
  python scripts/restore_db.py backups/kshetra_backup_YYYYMMDD_HHMMSS.db
  ```
