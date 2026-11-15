# Phase 1: Baseline Architecture & Audit Report

## 1. Repository Map (Before Refactoring)

```text
terrawise-ai/
├── backend/
│   ├── app.py                  # Monolithic 569-line Flask entrypoint (routes + auth + DB calls mixed)
│   ├── models.py               # Flat SQLAlchemy models (includes `is_demo` column, plaintext survey_number)
│   ├── database.py             # Auto-calls Base.metadata.create_all() and seeds 4 fake demo farmers + hardcoded admin password
│   ├── advice_engine.py        # Crop suitability & IPM scorer
│   ├── data_pipeline.py        # Open-Meteo & NASA POWER fetcher (no circuit breaker or worker isolation)
│   ├── geo_validator.py        # Shapely/PyProj polygon validator
│   ├── credential_cards.py     # ReportLab PDF generator (hard-codes 1800-123-4567 helpline)
│   ├── generate_fields.py      # Demo polygon generator script
│   └── utils.py                # Password hashing & safe_value helper
├── frontend/
│   └── src/
│       ├── App.tsx             # Single-view router (lacks /status, consent modal, profile export/delete, assistant tab)
│       ├── pages/
│       │   ├── Login.tsx       # Contains Demo Drawer (`?demo=1`, 'D' hotkey), hardcoded credentials, and time scrubber
│       │   ├── FarmerHome.tsx  # Farmer dashboard (lacks AI Assistant integration, announcements inbox, feedback buttons)
│       │   └── AdminPortal.tsx # Basic admin view (lacks land verification toggle, audit log viewer, announcements, CSV export)
│       └── components/         # Header, TodayCard, MiniCards, FarmMap, WhatToPlantModal, AmbientWeatherCanvas
├── data/                       # GeoJSON district/taluka boundaries + crops.json, glossary.json, risk-rules.json
└── tests/                      # 6 unittest files (depend on seeded demo accounts)
```

---

## 2. Baseline Findings & Blockers

| Category | Count | Details |
| :--- | :--- | :--- |
| **Demo / Sample / Placeholder Tokens** | **73 matches** | `is_demo` column & UI badges, `demo_farmers` auto-seeding in `backend/database.py`, `backend/generate_fields.py`, `Admin-Secure-Pass-2026`, `Mango-River-Tiger-47`, `Water-Flora-Wheat-19`, `showDemoDrawer` & `?demo=1` in `Login.tsx`, `simulatedHour` sun scrubber, hard-coded `1800-123-4567` helpline, fallback temperature string `नाशिक 19.4°C • अहिल्यानगर 20.4°C`. |
| **Architecture & Layering Gaps** | **8 issues** | Flat `backend/*.py` files instead of layered `app/{api,schemas,services,repositories,models,integrations,security,core,jobs}`; `Base.metadata.create_all()` instead of Alembic migrations; in-memory `ACTIVE_SESSIONS` dict instead of short-lived access tokens + hashed rotating refresh tokens with reuse detection. |
| **Security Gaps** | **6 issues** | Hard-coded default `app.secret_key`; `CORS(origins=["*"])`; missing security headers (`CSP`, `HSTS`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`); unencrypted `survey_number` and `mobile`; no CSRF token validation on cookie auth; no rate limiting on login/assistant endpoints. |
| **Bot Integration Gaps** | **Missing** | Standalone HTML bot (`fieldwise-mobile.html` / `KSHEtra-Smart-Farming-AI.html`) is not yet integrated into the Kshetra React frontend or `/api/v1/assistant/*` backend service. |
| **Missing Real-Site Features** | **7 features** | Officer taluka announcements & farmer inbox; advice/assistant thumbs up/down feedback & problem reporting; public `/status` page; DPDP Act 2023 first-login consent modal + Privacy/Terms + Profile data export/delete; versioned service worker (`sw.js`) & `robots.txt`; worker-isolated job runner (`worker.py`); Docker & reverse-proxy deployment configs. |
