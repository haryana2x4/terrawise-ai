# Phase 6 QA & Production Readiness Report (`docs/qa-report.md`)

**Date**: 2026-11-15  
**Application**: Kshetra v2.0.0 (`terrawise-ai`)

---

## 1. Automated Gate Results

| Verification Check | Command | Result | Evidence |
|---|---|---|---|
| **Zero-Demo Guard** | `python scripts/check_no_demo.py` | **PASS (Exit 0)** | `0 demo/sample/mock/placeholder or secret violations in production code.` |
| **Backend Flask Doctor** | `python -m flask doctor` | **PASS (Exit 0)** | `database_ping`, `crops_catalog`, `districts_geojson`, `talukas_geojson`, `devanagari_font` all `PASS`. |
| **Backend Test Suite** | `python -m pytest -v` | **PASS (13/13 Passed)** | Covers zero-demo routes, 40-farmer cap (1..40 succeed, 41st rejected 409, delete frees slot), 5-attempt lockout, refresh token reuse revocation, polygon geodesic/UTM-43N validation, overlap rejection, IDOR prevention, Krishi Mitra injection guard & rate limits, human profile updates, planting dates, crop rotation history, PDF cards, and DPDP data export/erasure. |
| **Frontend Type Check** | `npx tsc --noEmit` | **PASS (Exit 0)** | Zero TypeScript errors across all components and pages. |
| **Frontend Prod Build** | `npx vite build` | **PASS (Exit 0)** | Built `dist/index.html`, CSS (`14.99 kB` gzipped), and JS (`262.93 kB` gzipped) in `3.17s`. |
| **Client Bundle Secret Scan** | `Select-String dist/assets/*.js` | **PASS (0 Hits)** | Zero server-side keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET_KEY`, `AIza`, `sk-`) in client bundle. |

---

## 2. End-to-End Flows Verified

1. **Initial Admin Creation & Login**:
   - `flask create-admin` creates `ADMIN` account with Argon2id/PBKDF2 hash.
   - `POST /api/v1/auth/login` issues short-lived HS256 JWT access token + rotating refresh token.
2. **40-Farmer Cap & Credential Card PDF**:
   - `POST /api/v1/admin/farmers` creates farmers `1..40` inside `BEGIN IMMEDIATE` transaction and rejects the 41st with `HTTP 409 FARMER_CAP_REACHED`.
   - `GET /api/v1/reports/credential-card/<id>` generates a valid `%PDF-` A6 card with Devanagari font and QR login parameter (`?fid=<id>`).
3. **First-Login Consent & Password Change**:
   - `POST /api/v1/auth/consent` records DPDP Act 2023 consent timestamp.
   - `POST /api/v1/auth/change-password` updates password and clears `must_change_password`.
4. **Parcel Mapping, Geodesic vs UTM-43N Area & Overlap Guard**:
   - `POST /api/v1/parcels` validates RFC 7946 right-hand rule, min 0.5m vertex spacing, Ahilya Nagar / Nashik containment, `< 0.5%` divergence between WGS84 geodesic and UTM Zone 43N area, and `<= 2%` overlap across all parcels.
5. **Telemetry, Suitability & Missing != Zero (`G2`)**:
   - `safe_value(None, "mm")` renders `"No data"` (`"माहिती नाही"`), whereas `safe_value(0.0, "mm")` renders `"0.0 mm"`.
   - Every metric includes `provenance` (`source`, `fetched_at`, `stale`, `label`).
6. **Krishi Mitra AI Assistant (Phase 4)**:
   - `POST /api/v1/assistant/chat` grounds answers in the farmer's parcel, soil, and weather, blocks prompt injection (`safety_guard`), supports thumbs up/down feedback, and enforces hourly rate limits (`HTTP 429`).
7. **DPDP Act 2023 Self-Service Data Export & Erasure**:
   - `GET /api/v1/farmers/me/export` exports full JSON bundle.
   - `DELETE /api/v1/farmers/me` permanently erases the farmer's account, parcels, observations, and chat history.
