# Kshetra (क्षेत्र) — Agricultural Decision Support Platform

**Kshetra** (formerly TERRAWISE AI) is a zero-demo, production-grade agricultural decision support platform built for smallholder farmers and agricultural extension officers in **Ahilya Nagar** and **Nashik**, Maharashtra.

---

## Core Capabilities

1. **Zero-Demo Production Integrity**:
   - Every screen, endpoint, and metric reflects real field telemetry or explicit `"No data"` (`"माहिती नाही"` / `"कोई जानकारी नहीं"`).
   - Missing values never render as `0`, and every metric displays its upstream source and UTC timestamp.
   - Enforced by [`scripts/check_no_demo.py`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/scripts/check_no_demo.py).

2. **Transactional 40-Farmer Cap, Satellite GIS & 7/12 Parcel Mapping**:
   - Hard capacity of **40 active farmer accounts** enforced inside a database transaction (`BEGIN IMMEDIATE` on SQLite / `SELECT ... FOR UPDATE` on PostgreSQL).
   - Interactive Leaflet Satellite / Street / Topo boundary mapper (`Esri World Imagery` + `OSM` + `OpenTopoMap`) with draggable vertices, 29-taluka quick jump, 1-acre starter square, inline metadata edit (`PATCH /api/v1/parcels/<id>`), GeoJSON export, and Officer land-mapping mode.
   - Up to **4 parcels per farmer**, validated with RFC 7946 right-hand rule orientation, minimum 0.5m vertex spacing, district containment, dual-CRS geodesic (`WGS84`) vs projected (`UTM Zone 43N / EPSG:32643`) area cross-check (`< 0.5%` divergence), and `<= 2%` cross-parcel overlap guard.
   - Printable **A6 single** and **A4 batch** PDF credential cards with Devanagari typography (`NotoSansDevanagari`), plus printable Field Cadastral Dossier (`Ctrl+P`).

3. **Precision Agronomy Suite & Real-Time Telemetry**:
   - Integrates **Open-Meteo** (7-day forecast + 48h hourly wind/humidity/rain/solar + 30-day history + soil moisture), **ISRIC SoilGrids v2.0** (250m pH, SOC, clay/sand/silt, nitrogen, CEC), and **Agmarknet** (`data.gov.in`) behind an SSRF-safe allowlist, retry with backoff, circuit breaker, and database snapshot cache.
   - Computes **FAO-56 Parcel Irrigation Water Budget** (Liters/day & Liters/week), **48-Hour Optimal Spray Safety Window**, **Magnus-Tetens Dew Point**, **VPD** (Vapor Pressure Deficit), **GDD** (Growing Degree Days), **RSHI** (Regional Soil-Hydration Index 0–100), and **0–100 crop suitability scores** across 5 transparent factors (`water_match`, `soil_match`, `season_temp_match`, `duration_efficiency`, `rotation_health`) with interactive Recharts hydro-thermal telemetry charts.
   - Prioritizes **Integrated Pest Management (IPM)** with mandatory Krishi Vigyan Kendra (KVK) safety disclaimers.

4. **Krishi Mitra AI Assistant (Marathi / Hindi / English + Voice)**:
   - Grounded in each farmer's real parcel geometry, soil type, irrigation source, live weather, and crop suitability scores.
   - Pluggable provider adapter (`gemini`, `openai`, or deterministic grounded agronomic engine) with prompt-injection sanitization, per-farmer hourly message limits (`30/hr`), daily token budgets, thumbs up/down feedback, and 90-day retention.

5. **India DPDP Act 2023 Compliance**:
   - First-login Marathi/Hindi/English privacy consent flow, field-level PII encryption (`mobile_encrypted`, `survey_number_encrypted`), one-click **Export My Data (JSON)**, and self-service **Delete My Data**.

6. **Installable PWA & Multi-Device Sharing**:
   - Full Progressive Web App (`manifest.webmanifest`, `192/512` icons, Service Worker `sw.js`) installable on Android, iOS, Windows, and macOS.
   - Built-in **Install & Share Modal** with live Wi-Fi/LAN SVG QR code, one-click PWA install, Windows Standalone App (`Kshetra-App.bat`), and 1-click [`share_app.bat`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/share_app.bat) Waitress host mode (`start.py --share --prod`).

---

## Quick Start (Windows PowerShell)

```powershell
# 1. Backend setup & admin initialization
cd backend
python -m pip install -r requirements.txt
$env:FLASK_APP = "wsgi.py"
python -m flask doctor
python -m flask create-admin --admin-id ADMIN --name "Kshetra Agricultural Officer"
python wsgi.py

# 2. Frontend dev server (in a second terminal)
cd frontend
npm install
npm run dev
```

See [`RUN_LOCAL.md`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/RUN_LOCAL.md), [`ARCHITECTURE.md`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/ARCHITECTURE.md), [`DEPLOY.md`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/DEPLOY.md), and [`SECURITY.md`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/SECURITY.md) for complete documentation.

---

## Built with AI Assistance

Developed and upgraded with assistance from **Google Antigravity** (used for layered backend refactoring, security hardening, Krishi Mitra bot integration, automated test authoring, and technical documentation).

## License

MIT License — see [`LICENSE`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/LICENSE).
