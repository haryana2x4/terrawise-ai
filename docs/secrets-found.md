# Phase 4.1: Secrets Scan & Audit Log (`/docs/secrets-found.md`)

## Scan Scope
- Scanned all discovered HTML files (`fieldwise-mobile.html`, `KSHETRA -mission control.html`, `ahh.html`)
- Scanned companion project (`C:\Users\Rocky\Downloads\Feildwise AI\Feildwise AI\.env`)
- Scanned entire `terrawise-ai` repository (`backend/`, `frontend/`, `data/`, `services/ai-bot/`, `modules/orien/`)

## Findings
- **Hard-coded Live API Keys Found**: **0**
  - In `Feildwise AI\.env`, `GEMINI_API_KEY=""`, `OPENAI_API_KEY=""`, and `EARTHDATA_TOKEN=""` were empty string placeholders (`len=2`), so no live third-party API keys were leaked or require emergency rotation.
- **Hard-coded Prototype Passwords Removed**:
  - Removed prototype seed passwords (`Admin-Secure-Pass-2026`, `Mango-River-Tiger-47`, `Water-Flora-Wheat-19`, `Onion-Cloud-Soil-82`, `Grape-Sun-River-64`) from `backend/database.py` and `frontend/src/pages/Login.tsx`.
  - Replaced default `app.secret_key` fallback in production mode with mandatory startup validation in `backend/app/config.py`.
