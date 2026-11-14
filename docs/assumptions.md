# TERRAWISE AI Pilot — Assumptions Log

> **Rule**: When the prompt and PRD conflict, the prompt wins. All assumptions are logged here per project instructions.

## Project Context
- **Date**: 2026-11-14
- **Pilot Districts**: **Ahilya Nagar** (formerly Ahmednagar, also spelled Ahilyanagar) and **Nashik**, Maharashtra, India.
- **Pilot Scope**: Up to 20 real or demo farmers (default 10 per district), each with an isolated ID, password, and farm parcel boundaries.
- **Languages**: Marathi (default), Hindi, English.
- **Platform Stack**: React 19 + Vite + Tailwind CSS + Recharts (Frontend), Flask 3 + SQLAlchemy + SQLite (Backend), Shapely + PyProj (GIS Validation), ReportLab (PDF Generation).

---

## 1. PRD & Input Assumptions
1. **PRD File**: No external `prd.pdf` was supplied in the workspace root. The project brief and NASA Space Apps "Field Shift" problem statement serve as seed requirements, extended into an autonomous pilot PRD written into `/docs/PRD.md` and compiled to `/docs/PRD.pdf`.
2. **Farmer CSV**: No external `FARMERS_CSV` was provided. An administrative "Add Farmer" workflow is built, and 4 realistic demo personas (2 for Ahilya Nagar, 2 for Nashik) are seeded with `is_demo: true` and visible "Demo" tags. No fake polygons are generated.
3. **District Naming**: The Maharashtra government formally renamed "Ahmednagar" to "Ahilya Nagar" (also written "Ahilyanagar"). Many national portals (IMD, Agmarknet, Census, CGWB) still use "Ahmednagar". The system accepts and maps both names internally, standardizing canonical storage to `Ahilya Nagar` with district code `AHN`.

---

## 2. Agronomy & Crop Rules
1. **Focus Crops**: Research covers 16 major crops of both districts: Onion, Grapes, Pomegranate, Tomato, Sugarcane, Soybean, Bajra, Jowar, Maize, Wheat, Gram (Chickpea), Tur (Pigeon Pea), Cotton, Groundnut, Green Gram (Moong), Black Gram (Urad).
2. **Seasons**: Kharif (June–October), Rabi (October–March), Summer (March–June), Perennial (Grapes, Pomegranate, Sugarcane).
3. **Pest Guidance**: Exclusively IPM-first (cultural, physical, biological). Chemical formulations and doses are cited *only* where explicitly documented in MPKV Rahuri Package of Practices or ICAR advisories; otherwise, farmers are instructed: "Ask KVK / कृषी विज्ञान केंद्राशी संपर्क साधा".
4. **Scoring Engine**: Explainable, deterministic multi-criteria scoring balancing soil suitability, seasonal moisture, temperature band, water availability, crop rotation benefits, and market stability.

---

## 3. Geospatial & Boundary Rules
1. **Field Polygon Source**: Since no open API exposes cadastral parcel polygons in Maharashtra, the application supports:
   - Farmer/officer drawing on satellite tiles using Google Maps Data Layer / Leaflet Polygon editing.
   - GPS "Walk my boundary" mobile mode (filtering accuracy < 10m).
   - GeoJSON/KML/Shapefile file upload.
   - OSM `landuse=farmland` polygon suggestions with mandatory farmer confirmation.
2. **Coordinate System**: WGS84 (EPSG:4326) with 6 decimal places, counter-clockwise exterior ring (RFC 7946). Geodesic area computed with WGS84 ellipsoid and cross-checked against UTM Zone 43N (EPSG:32643).
3. **Overlap Threshold**: Any overlap greater than 2% of the smaller parcel between two farmers is blocked and flagged for field officer resolution.

---

## 4. Security & Privacy
1. **Farmer Isolation**: Farmers authenticate via natural, pronounceable credentials and can view only their own land, weather, and recommendations.
2. **Hard Limit**: Maximum 20 farmers strictly enforced in a locked SQLite transaction (`BEGIN IMMEDIATE`). Attempt #21 receives HTTP 409 `FARMER_LIMIT_REACHED`.
3. **Secrets**: Stored exclusively in `.env`.
4. **Credential PDFs**: Natural passwords (e.g., `Mango-River-Tiger-47`) exist in memory only at creation/reset and appear solely on printable credential cards.
5. **Password Hash Implementation**: Where host Windows Application Control policies restrict external compiled C-FFI binaries (such as `_argon2_cffi_bindings`), the system automatically and securely defaults to Python's built-in memory-hard `hashlib.scrypt` (RFC 7914, $scrypt$ format, N=16384, r=8, p=1), maintaining OWASP memory-hardness standards without external DLL failures.
