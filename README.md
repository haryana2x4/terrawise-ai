# TERRAWISE AI — Precision Agro-Climatic Platform, AI Bot & Orien Portal

TERRAWISE AI is an integrated full-stack monorepo combining:
1. **TERRAWISE AI (`backend/`, `frontend/`, `data/`, `tests/`)**: A precision agro-climatic decision-support pilot for up to **20 smallholder farmers** in **Ahilya Nagar (Ahmednagar)** and **Nashik** districts of Maharashtra, India. Farmers sign in with their individual ID, view verified land boundaries on an interactive satellite map, and receive Grade-4 Marathi/Hindi/English crop, soil-water, weather, and IPM pest guidance backed by live Open-Meteo and NASA POWER telemetry.
2. **SUNDAY v2 AI Bot (`services/ai-bot/`)**: A local-first, offline-capable WebGL/Three.js and Node.js conversational companion and sandboxed skill runner (`server.js`).
3. **Orien / Beyond Earth Orbital Portal (`modules/orien/`)**: A React 19 + Vite + TypeScript + Tailwind 4 candidate application and orbital mission telemetry portal.

---

## Repository Structure

```text
terrawise-ai/
├── backend/            # Flask + SQLAlchemy + Shapely/PyProj GIS REST API (port 5000)
├── frontend/           # React 18 + TypeScript + Vite + Tailwind CSS farmer & admin web app
├── data/               # GeoBoundaries district & taluka GeoJSON layers for Ahilya Nagar & Nashik
├── tests/              # Python unittest suite (GIS validation, 20-farmer cap, scoring, API)
├── services/
│   └── ai-bot/         # SUNDAY v2 Node.js + WebSocket + Three.js AI companion service
├── modules/
│   └── orien/          # Orien / Beyond Earth React + Vite + TypeScript portal module
└── docs/               # PRD, district agronomy profiles, design system, and audit documentation
```

---

## How to Run Locally

### Prerequisites
- **Python 3.11+** (tested with Python 3.12)
- **Node.js 18+ LTS** & **npm** (tested with Node.js v22 / v26)
- **Git**

### 1. Environment Configuration
Copy `.env.example` to `.env` in the repository root:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```
```bash
# macOS / Linux
cp .env.example .env
```

| Environment Variable | Required | Default | Description / Fallback Behavior |
| :--- | :--- | :--- | :--- |
| `FLASK_SECRET_KEY` | Recommended | Built-in fallback | Secret key used by Flask session signing. |
| `MAX_FARMERS` | Optional | `20` | Hard cap on registered pilot farmers enforced via SQLite `BEGIN IMMEDIATE`. |
| `PORT` | Optional | `5000` | HTTP port for the TERRAWISE backend server. |
| `VITE_GOOGLE_MAPS_KEY` | Optional | Empty | Google Maps tile key; falls back automatically to Leaflet + OpenStreetMap + NASA GIBS. |
| `DATA_GOV_IN_API_KEY` | Optional | Empty | Live APMC mandi price feed key; falls back to cached/research MSP baselines. |
| `COPERNICUS_CLIENT_ID` | Optional | Empty | Optional Sentinel-2 NDVI credential. |
| `COPERNICUS_CLIENT_SECRET` | Optional | Empty | Optional Sentinel-2 NDVI secret. |

---

### 2. Run TERRAWISE AI (Backend + Frontend)

```powershell
# 1. Install Python dependencies
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # macOS/Linux: source .venv/bin/activate
pip install flask flask-cors sqlalchemy argon2-cffi shapely pyproj qrcode reportlab pillow requests

# 2. Generate demo parcel boundaries (excluded from git tracking)
python backend/generate_fields.py

# 3. Build the React frontend
cd frontend
npm install
npm run build
cd ..

# 4. Start the full-stack server on http://127.0.0.1:5000
python backend/app.py
```

For hot-reload frontend development on `http://127.0.0.1:5173` (proxying `/api` to `http://127.0.0.1:5000`):
```bash
cd frontend
npm run dev
```

#### Running the TERRAWISE Automated Test Suite
```bash
python -m unittest discover tests
```

---

### 3. Run the SUNDAY v2 AI Bot (`services/ai-bot`)

```bash
cd services/ai-bot
npm install
node server.js
```
Run the bot evaluation suites:
```bash
node tests/smoke_test.js
node tests/eval_suite.js
node tests/expansion_suite.js
```

---

### 4. Run the Orien / Beyond Earth Module (`modules/orien`)

```bash
cd modules/orien
npm install
npm run dev
```

---

## Documentation Index

- [Product Requirements Document (`docs/PRD.md`)](docs/PRD.md)
- [Ahilya Nagar Agronomy Profile (`docs/research/ahilyanagar-profile.md`)](docs/research/ahilyanagar-profile.md)
- [Nashik Agronomy Profile (`docs/research/nashik-profile.md`)](docs/research/nashik-profile.md)
- [Design System (`docs/design-system.md`)](docs/design-system.md)
- [Known Issues (`docs/known-issues.md`)](docs/known-issues.md)
- [Excluded Upload Paths (`docs/upload-skipped.md`)](docs/upload-skipped.md)

---

## Built with AI Assistance

This project was developed and consolidated with AI assistance from **Google Antigravity**, which was used for full-stack application authoring, geospatial validation logic, agronomy research synthesis, frontend UI design, debugging, and project documentation.

---

## License

Released under the [MIT License](LICENSE).
