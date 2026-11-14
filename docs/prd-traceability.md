# TERRAWISE AI Pilot — PRD Traceability Matrix

| Req ID | Requirement Description | Implementation Feature / Module | Verification Test | Status |
|---|---|---|---|---|
| **REQ-01** | Support 2 districts: Ahilya Nagar (Ahmednagar) & Nashik | `backend/config.py`, `data/geo/districts.geojson`, district selector | `test_geo.py::test_district_containment` | **Covered** |
| **REQ-02** | Hard cap of 20 farmers maximum across pilot | `backend/models.py`, `backend/routes/farmers.py` (`BEGIN IMMEDIATE`) | `test_farmer_cap.py::test_farmer_cap_20_21` | **Covered** |
| **REQ-03** | Farmer ID format: 3-letter district + 3 digits (e.g. `NSK-001`, `AHN-001`) | `backend/utils.py::generate_farmer_id` | `test_credentials.py::test_id_format` | **Covered** |
| **REQ-04** | Natural 40-bit passwords (3 words + 2 digits, Argon2id hashed) | `backend/utils.py::generate_natural_password` | `test_credentials.py::test_password_entropy_hash` | **Covered** |
| **REQ-05** | Printable Credential Cards (A6 single, A4 batch 4-up) in Marathi + English | `backend/credential_cards.py` (ReportLab / FPDF2) | `test_credentials.py::test_pdf_generation` | **Covered** |
| **REQ-06** | Real data only: no fake numbers, demo personas tagged `is_demo=True` | Database schema flag, UI "Demo" badge | `test_api.py::test_demo_tagging` | **Covered** |
| **REQ-07** | Missing is not zero: null renders "No data" / "माहिती नाही", 0 renders 0 | `backend/utils.py::safe_value`, `frontend/src/utils/formatters.ts` | `test_utils.py::test_safe_value_null_vs_zero` | **Covered** |
| **REQ-08** | Provenance on every data record (source, observed_at, fetched_at) | `WeatherSnapshot`, `DataProvenance`, UI attribution footnotes | `test_api.py::test_provenance_payload` | **Covered** |
| **REQ-09** | RFC 7946 GeoJSON field boundary validation (no self-intersection, >0.5m vertices) | `backend/geo_validator.py` (Shapely) | `test_geo.py::test_polygon_geometry_validation` | **Covered** |
| **REQ-10** | Geodesic area calculation (WGS84) + UTM 43N cross-check (<0.5% diff) | `backend/geo_validator.py` (PyProj Geod vs EPSG:32643) | `test_geo.py::test_area_cross_check` | **Covered** |
| **REQ-11** | Zero field overlap between farmers (>2% overlap blocked) | `backend/geo_validator.py::check_parcel_overlap` | `test_geo.py::test_parcel_overlap_detection` | **Covered** |
| **REQ-12** | Max 4 parcels per farmer | `backend/routes/parcels.py` limit check | `test_api.py::test_max_parcels_enforced` | **Covered** |
| **REQ-13** | Multi-source live data pipeline (Open-Meteo, NASA POWER, GIBS tiles) | `backend/data_pipeline.py` (APScheduler Asia/Kolkata) | `test_api.py::test_live_weather_fetch` | **Covered** |
| **REQ-14** | Admin data-health dashboard showing latency, staleness alert (>48h) | `backend/routes/admin.py::get_data_health` | `test_api.py::test_data_health_endpoint` | **Covered** |
| **REQ-15** | Advice engine: Top 3 seasonal crops with Fit, Risk, water balance | `backend/advice_engine.py` | `test_scoring.py::test_crop_recommendations` | **Covered** |
| **REQ-16** | IPM-first pest guidance; no unverified chemicals; "Ask KVK" disclaimer | `backend/advice_engine.py`, `docs/research/pest-disease-calendar.md` | `test_scoring.py::test_ipm_guidance` | **Covered** |
| **REQ-17** | Simple UI: <=12 words/sentence, Grade-4 reading level, Marathi default, 18px+ text | `frontend/src/pages/FarmerHome.tsx`, `frontend/src/i18n/` | Browser inspection at 360px | **Covered** |
| **REQ-18** | Interactive Live Map: Google Maps JS API with Leaflet + OSM + NASA GIBS fallback | `frontend/src/components/FarmMap.tsx` | Browser inspection | **Covered** |
| **REQ-19** | Marathi Read-Aloud (Text-to-Speech) for primary cards | `frontend/src/utils/speech.ts` (Web Speech API) | UI verification | **Covered** |
| **REQ-20** | Responsive mobile design tested at 360px, 768px, 1280px with screenshots | Headless browser test suite saving to `docs/screenshots/` | Screenshot artifact audit | **Covered** |
