# Changelog

All notable architectural and API changes to **Kshetra (formerly TERRAWISE AI)** are documented here.

## [2.2.0] — 2026-11-15 — 40-Farmer Capacity, Human Profile Enrichments & Crop Rotation Logging

### Added & Updated
- **Capacity Raised (`20 -> 40`)**:
  - Expanded hard capacity from `20` to `40` active farmers across `.env`, `.env.example`, `backend/app/config.py`, repositories, OpenAPI spec, docs, UI capacity meters, and `test_hard_40_farmer_cap_enforcement`.
- **Natural Human Farmer Profiles & Officer Console Enhancements**:
  - Extended `Farmer` model with `holder_relation`, `farmer_category`, `primary_crops`, `farming_experience_years`, and `bio_note` (with idempotent SQLite/PG schema migration in `create_app()`), `PATCH /api/v1/admin/farmers/<farmer_id>`, dynamic 29-taluka dropdowns in [`AdminPortal.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/pages/AdminPortal.tsx), live roster search & District/Status filters, and inline Profile Editor.
- **Parcel Sowing Date & Crop Rotation History**:
  - Added `planting_date` creation/editing to [`FarmMap.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/components/FarmMap.tsx) & `PATCH /api/v1/parcels/<id>`, wired one-click **Log Sown Crop** (`POST /api/v1/parcels/<id>/history`) inside [`WhatToPlantModal.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/components/WhatToPlantModal.tsx), surfaced crop rotation badges inside [`FarmerHome.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/pages/FarmerHome.tsx) Field Dossier, and enriched `AssistantService` context.

## [2.1.0] — 2026-11-15 — Competition Precision GIS, Living Environment & Agronomy Suite

### Added & Upgraded
- **Interactive Satellite GIS Land Marking ([`FarmMap.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/components/FarmMap.tsx))**:
  - Bundled `leaflet/dist/leaflet.css` directly with automatic `ResizeObserver`/`invalidateSize()`, Esri World Imagery Satellite default + OpenStreetMap + OpenTopoMap layer switcher, 29-taluka centroid selector across Ahilya Nagar & Nashik, one-click **Drop 1-Acre Quick Plot**, real-time spherical geodesy HUD (Acres, Gunthas, Hectares, Perimeter), inline **Edit Metadata / Delete / GeoJSON Download**, and Officer-side farmer land mapping directly inside [`AdminPortal.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/pages/AdminPortal.tsx).
- **Astronomical Living Background & Design Polish ([`LivingBackground.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/components/LivingBackground.tsx), [`FarmerHome.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/pages/FarmerHome.tsx), [`Login.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/pages/Login.tsx))**:
  - Dynamic solar phase gradients, astronomical sun altitude readout, subtle weather atmosphere (Full/Lite toggle synced across Header, Login, Farmer, and Officer views), multi-parcel switcher pills, and printable `@media print` Field Dossier.
- **Competition Precision Agronomy ([`AdviceAndRiskService`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/backend/app/services/__init__.py), [`PrecisionAnalyticsPanel.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/components/PrecisionAnalyticsPanel.tsx))**:
  - Fixed `crops.json` schema mapping (`marathi_name`, `hindi_name`, `common_name`, `water_need_mm`, `soil_preference`, `temp_range_c`, `typical_yield_kg_ha`, `price_range_inr_qtl`, `key_growth_stages`).
  - Added FAO-56 parcel net water volume engine (Liters/day & Liters/week), Magnus-Tetens dew point, 48-hour hourly optimal spray safety window evaluator, 7-day Recharts Rainfall/ET0/Tmax hydro-thermal chart, ISRIC SoilGrids 250m soil chemistry panel, and parcel yield/value estimate.
  - Added `PATCH /api/v1/parcels/<id>` metadata/geometry editor and `?parcel_id=` dashboard switcher.
- **PWA App Installability, Reachability & Downloads ([`InstallAppModal.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/components/InstallAppModal.tsx), [`manifest.webmanifest`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/public/manifest.webmanifest), [`start.py`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/start.py))**:
  - Added full W3C PWA manifest (`manifest.webmanifest`), generated PNG icons (`192x192`, `512x512`, `maskable`, `180x180` Apple touch icon), upgraded offline Service Worker (`sw.js`), and registered SW in `main.tsx`.
  - Added `/api/v1/meta/access-info`, allowlisted SVG QR endpoint `/api/v1/meta/access-qr`, downloadable `Kshetra-App.bat` standalone desktop launcher `/api/v1/meta/download/windows-launcher`, Waitress single-port production server (`start.py --share --prod` / `share_app.bat`), and dynamic LAN CORS support (`ALLOW_LAN_ORIGINS`).
  - Added Esri World Imagery & OpenTopoMap origins + `worker-src` / `manifest-src` to `Content-Security-Policy` headers in [`security/__init__.py`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/backend/app/security/__init__.py).

## [2.0.0] — 2026-11-15

### Breaking / Production Upgrade Changes
- **Removed All Demo & Seeded Data (Phase 2)**:
  - Removed `/api/auth/demo`, `is_demo` database flags, auto-seeded farmer accounts (`AHN-001`..`NSK-005`), hard-coded passwords (`Mango-River-Tiger-47`, `Admin-Secure-Pass-2026`), login demo drawer (`?demo=1`, `'D'` shortcut), sun/time simulator scrubber, and placeholder helpline `1800-123-4567`.
  - Added `flask create-admin` CLI command for initializing the administrator account.
  - Added [`scripts/check_no_demo.py`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/scripts/check_no_demo.py) guard script.
- **Rebuilt Backend into Layered Production Package (Phase 3)**:
  - Replaced flat `backend/*.py` files with `backend/app/` (`config.py`, `extensions.py`, `core/`, `security/`, `models/`, `repositories/`, `integrations/`, `services/`, `schemas/`, `api/v1/`, `jobs/`, `cli.py`), `backend/wsgi.py`, `backend/worker.py`, `backend/Dockerfile`, and `backend/migrations/`.
  - Mounted versioned `/api/v1/*` routes along with backward-compatible `/api/*` aliases.
  - Enforced atomic 40-farmer cap (originally 20, expanded to 40 in v2.2.0) and atomic `<=2%` parcel overlap validation.
  - Added rotating refresh tokens with token-family reuse detection and field-level PII encryption (`mobile_encrypted`, `survey_number_encrypted`).
- **Integrated Krishi Mitra AI Assistant (Phase 4)**:
  - Audited and sanitized the standalone bot HTML into [`docs/legacy/bot.html`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/docs/legacy/bot.html).
  - Implemented `AssistantService` (`POST /api/v1/assistant/chat`, `GET/DELETE /api/v1/assistant/history`, `POST /api/v1/assistant/feedback`) with provider adapter (`gemini`, `openai`, and deterministic grounded agronomic engine), prompt-injection defense, hourly message limits, and 90-day retention.
  - Built [`frontend/src/components/AssistantChat.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch\terrawise-ai/frontend/src/components/AssistantChat.tsx) with Marathi/Hindi/English, voice input, TTS read-aloud, grounded quick chips, and thumbs up/down ratings.
- **Added Production Extras & DPDP Act 2023 Compliance (Phase 5)**:
  - Upgraded [`AdminPortal.tsx`](file:///C:/Users/Rocky/.gemini/antigravity/scratch/terrawise-ai/frontend/src/pages/AdminPortal.tsx) with `N of 40` capacity bar, 7/12 land verification toggle, Officer announcements publisher, farmer feedback viewer, source health panel, immutable audit log, PDF credential cards, and CSV export.
  - Added first-login DPDP Act 2023 consent screen, first-login password change flow, daily field rainfall logger, JSON data export (`/api/v1/farmers/me/export`), and self-service account erasure (`DELETE /api/v1/farmers/me`).
  - Added public `/status` modal & endpoint (`/api/v1/meta/status`), `/healthz`, `/readyz`, `/api/v1/openapi.json`, `sw.js`, and `robots.txt`.
