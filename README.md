# TERRAWISE AI

Precision agro-climatic advisor and interactive 3D companion suite built for smallholder farmers in **Ahilya Nagar** and **Nashik**, Maharashtra.

## Overview

- **TERRAWISE Agro-Advisor (`backend/`, `frontend/`, `data/`, `tests/`)** — Full-stack GIS and meteorological decision-support platform powered by Open-Meteo and NASA POWER telemetry. Supports Marathi, Hindi, and English with interactive parcel boundary validation, multi-factor crop suitability scoring, IPM advisories, and printable farmer credential cards.
- **SUNDAY v2 (`services/ai-bot/`)** — Local-first Node.js + Three.js 3D voxel companion and sandboxed skill runner.
- **Beyond Earth — Orien (`modules/orien/`)** — React 19 + TypeScript + Three.js orbital telemetry and mission portal.

---

## Project Structure

```text
terrawise-ai/
├── backend/            # Flask REST API, SQLAlchemy models, Shapely/PyProj GIS validator
├── frontend/           # React + TypeScript + Vite + Tailwind CSS web client
├── data/               # District/taluka GeoJSON layers & crop/IPM reference datasets
├── tests/              # Python unit & integration test suite
├── services/ai-bot/    # SUNDAY v2 3D Enderman companion studio
└── modules/orien/      # Beyond Earth orbital portal module
```

---

## Quick Start

### 1. Environment Setup

```bash
cp .env.example .env
```

### 2. Backend & Frontend (TERRAWISE AI)

```bash
# Install backend dependencies
python -m venv .venv
.venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt

# Generate sample parcel boundaries
python backend/generate_fields.py

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Start server on http://127.0.0.1:5000
python backend/app.py
```

Run backend tests:

```bash
python -m unittest discover tests
```

### 3. SUNDAY v2 Studio (`services/ai-bot`)

```bash
cd services/ai-bot
npm install
node server.js
```

### 4. Beyond Earth Portal (`modules/orien`)

```bash
cd modules/orien
npm install
npm run dev
```

---

## License

MIT © [Aryan Ramdinesh Kurmi](https://github.com/haryana2x4)
