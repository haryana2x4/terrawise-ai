# Kshetra (TERRAWISE AI) — Production Engineering Execution Plan

## Objective
Transform **Kshetra (TERRAWISE AI)** from a pilot prototype with seeded demo accounts into a hardened, zero-demo, production-grade agricultural decision-support platform for real farmers and extension officers in Maharashtra (Ahilya Nagar & Nashik).

---

## Ordered Execution Phases

### Phase 1: Baseline & Audit
1. Map current repository structure (`backend/`, `frontend/`, `data/`, `tests/`, `services/ai-bot/`, `modules/orien/`).
2. Run existing backend tests and frontend build to establish baseline metrics.
3. Audit all demo, sample, placeholder, and flat-file architectural bottlenecks in `/docs/baseline.md`.

### Phase 2: Complete Demo & Placeholder Removal
1. Scan codebase for forbidden tokens (`demo`, `sample`, `mock`, `dummy`, `fake`, `lorem`, `placeholder`, `password123`, `is_demo`, `?demo=1`, `TODO`, `FIXME`, `console.log`, hard-coded credentials).
2. Remove all seeded demo accounts (`AHN-001`, `NSK-001`, `ADM-001` with hard-coded passwords) from database initialization.
3. Remove the login page Demo Drawer, `?demo=1` query trigger, keyboard shortcut `D`, sun/time simulation scrubber, `is_demo` badges, and hard-coded helpline numbers.
4. Implement CLI bootstrap (`flask --app wsgi.py create-admin`) for initial administrator provisioning via prompt or one-time environment variable.
5. Add automated guard script `scripts/check_no_demo.py` to fail CI/tests if forbidden demo words appear in production code.
6. Document all removals in `/docs/demo-removal-report.md`.

### Phase 3: Production-Grade Layered Backend (`backend/app/`)
1. Restructure `backend/` into the layered architecture:
   - `app/__init__.py` (`create_app` factory)
   - `app/config.py` (`DevelopmentConfig`, `TestingConfig`, `ProductionConfig` with startup validation)
   - `app/extensions.py` (SQLAlchemy 2.x, Alembic migrations, rate limiter, cache, CORS)
   - `app/core/` (`errors.py`, `logging.py`, `request_id.py`, `pagination.py`, `units.py`, `values.py` for "No data" vs `0`)
   - `app/security/` (Argon2id/scrypt hashing, short-lived access + hashed rotating refresh tokens with reuse detection, RBAC decorators with object-level IDOR checks, lockout, security headers, field encryption for survey number & mobile, append-only audit log)
   - `app/models/` (Users/Farmers, Farms, Parcels, CropHistory, WeatherSnapshots, SoilProfiles, Announcements, Feedback, AssistantMessages, RefreshTokens, SourceHealth, AuditLogs)
   - `app/repositories/` (all SQL/ORM queries isolated here; atomic `BEGIN IMMEDIATE` / row-locked 40-farmer cap + non-overlapping parcel transaction)
   - `app/integrations/` (Open-Meteo, NASA POWER, ISRIC SoilGrids, Agmarknet, NASA GIBS, Sentinel, Google Maps/Geocoding, Web Push — with timeouts, retries, circuit breaker, SSRF allowlist, and source-health recording)
   - `app/services/` (AdviceEngine, RiskEngine, GeoValidationService, CredentialCardService, IngestionService, NotificationService, AssistantService)
   - `app/schemas/` (strict request/response validation)
   - `app/api/v1/` (thin modular blueprints: `auth`, `farmers`, `farms`, `parcels`, `climate`, `soil`, `water`, `crops`, `advice`, `risk`, `pests`, `markets`, `notifications`, `assistant`, `reports`, `announcements`, `feedback`, `admin`, `meta`)
   - `app/jobs/` & `worker.py` (isolated background ingestion & 48-hour staleness monitor)
   - `app/cli.py` (`create-admin`, `ingest`, `send-monthly`, `backup`, `doctor`)
   - `migrations/` (Alembic environment & initial migration script)
   - `wsgi.py`, `Dockerfile`, root `docker-compose.yml`, and `deploy/Caddyfile` + `deploy/nginx.conf`.

### Phase 4: Bot Integration (`KSHEtra-Smart-Farming-AI.html` / `fieldwise-mobile.html`)
1. Audit discovered bot HTML files (`fieldwise-mobile.html`, `KSHETRA -mission control.html`, `ahh.html`, and `Feildwise AI` assistant) in `/docs/bot-audit.md` and `/docs/secrets-found.md`.
2. Archive sanitized legacy HTML bot at `/docs/legacy/bot.html`.
3. Implement `app/services/assistant_service.py` with pluggable provider adapter (Gemini, OpenAI, Ollama, and deterministic grounded agronomic engine) behind `/api/v1/assistant/chat`, `/api/v1/assistant/history`, and `/api/v1/assistant/feedback`.
4. Enforce per-farmer rate limits, daily token budgets, prompt-injection sanitization, KVK safety guardrails, and 90-day retention.
5. Build React `AssistantChat.tsx` component with Marathi/Hindi/English support, voice input & read-aloud, quick-question & field-specific chips, sanitized Markdown rendering, and thumbs up/down feedback.

### Phase 5: Real-Site Production Extras
1. **Admin Console**: `N of 40` registration meter, create/edit farmer, reset password, lock/unlock, verify land, A6/A4 PDF credential cards, source health table, audit log viewer, notification log, CSV export.
2. **Officer Announcements**: Taluka-targeted weather/pest alerts pushed to farmers' in-app inbox.
3. **Feedback System**: Thumbs up/down on advice cards & assistant replies + "Report a problem" modal.
4. **Public `/status` Page**: Live data-source health and freshness without exposing personal data.
5. **DPDP Act 2023 Privacy, Terms & Consent**: First-login consent modal in Marathi/Hindi/English, Privacy & Terms views, plus self-service JSON Data Export and Delete-My-Data in Farmer Profile.
6. **Production Polish & Docs**: 404/500/Offline boundaries, versioned `sw.js`, `robots.txt`, Open Graph tags, `/api/v1/meta/version`, `ARCHITECTURE.md`, `RUN_LOCAL.md`, `DEPLOY.md`, `SECURITY.md`, `CHANGELOG.md`, and `docs/openapi.json`.

### Phase 6: End-to-End Verification
1. Run `scripts/check_no_demo.py`, `pytest` (unit, integration, API, IDOR security, 40-farmer concurrency, assistant guardrails), frontend TypeScript check & Vite production build, and bundle secret scan.
2. Verify live stack and write `/docs/qa-report.md`.
