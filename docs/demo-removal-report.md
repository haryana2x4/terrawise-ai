# Phase 2: Demo & Placeholder Removal Report

All demo, sample, mock, and placeholder artifacts have been stripped from production code (`backend/app/` and `frontend/src/`), verified by `python scripts/check_no_demo.py`.

## Removed or Replaced Items

| File / Path | Removed Artifact | Production Replacement |
| :--- | :--- | :--- |
| `backend/database.py` (removed) | Auto-seeding of `ADM-001` (`Admin-Secure-Pass-2026`) and 4 fake farmers (`AHN-001`, `AHN-002`, `NSK-001`, `NSK-002`) with hard-coded passwords (`Mango-River-Tiger-47`, etc.) and `Demo Gat-7/12` parcels. | Replaced by explicit CLI command `flask --app backend/wsgi.py create-admin` (prompts for password or reads `INITIAL_ADMIN_PASSWORD` from env). Farmers are created exclusively by authenticated admins/officers via `/api/v1/admin/farmers`. |
| `backend/generate_fields.py` (removed) | Script that generated synthetic `demo_fields` with `"is_demo": True` into `data/geo/fields.geojson`. | Removed from production backend. Synthetic test polygons exist strictly inside `backend/tests/conftest.py`. |
| `backend/models.py` -> `backend/app/models/user.py` | `is_demo = Column(Boolean)` flag on `Farmer` model. | Removed column; all registered users in production are real accounts with `consent_accepted_at` and encrypted PII fields. |
| `backend/credential_cards.py` -> `backend/app/services/credential_service.py` | ReportLab `getSampleStyleSheet()` and hard-coded `1800-123-4567` helpline text. | Custom `StyleSheet1` typography definitions; support helpline read dynamically from `SUPPORT_CONTACT` environment variable (omitted when unset). |
| `frontend/src/pages/Login.tsx` | `showDemoDrawer` slide-over drawer, `?demo=1` query trigger, `'D'` keyboard shortcut, quick-fill persona buttons (`AHN-001`, `NSK-001`, `ADM-001`), `simulatedHour` time-of-day scrubber, fallback temperature string `नाशिक 19.4°C • अहिल्यानगर 20.4°C`, and `1800-123-4567` footer text. | Clean production login card; live district weather displays `"माहिती नाही / No data"` when offline instead of fabricated temperatures; footer displays `SUPPORT_CONTACT` only if configured via `/api/v1/meta/version` and links to `/status`, Privacy, Terms, and Accessibility views. |
| `frontend/src/components/Header.tsx` & `frontend/src/i18n/translations.ts` | `farmer?.is_demo` badge rendering and `demo_badge` translation keys. | Removed `demo_badge` and all `is_demo` checks; added navigation tabs for Dashboard, AI Assistant, Announcements Inbox, and Farmer Profile. |
| `frontend/src/pages/AdminPortal.tsx` | `placeholder="..."` attributes containing fake names (`उदा. शंकर माधव शिंदे`) and `console.log` calls. | Replaced with accessible field labels and aria-describedby hints without forbidden tokens. |
