# Engineering Assumptions & Decisions Log

1. **Bot HTML Discovery (`BOT_HTML`)**:
   - Workspace and system search located three related agricultural HTML artifacts authored for this project:
     1. `fieldwise-mobile.html` (`C:\Users\Rocky\Documents\fieldwise-mobile.html` and WhatsApp transfer copy) — Contains the mobile-first Marathi/Hindi/English farming UI and `#app` AI Assistant chat interface (`function assistant()`, `ask()`, quick-access pills, and `/api/assistant/chat` integration).
     2. `KSHETRA -mission control.html` — Contains the KSHETRA Mission Control telemetry & NDVI bare-fallow window scanner UI.
     3. `Feildwise AI` (`C:\Users\Rocky\Downloads\Feildwise AI\Feildwise AI\`) — Contains the companion `AgronomicAssistant` engine supporting Gemini (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`), and a deterministic rule-based agronomic fallback grounded in NASA POWER and ISRIC SoilGrids.
   - We consolidated and archived a sanitized single-file reference at `docs/legacy/bot.html` (`KSHEtra-Smart-Farming-AI.html`) and integrated the full assistant architecture through `/api/v1/assistant/*` and `frontend/src/components/AssistantChat.tsx`.

2. **Zero-Demo Production Posture**:
   - All seeded demo accounts (`AHN-001`, `NSK-001`, `ADM-001`) have been removed from automatic startup seeding.
   - A fresh database starts with **0 farmers** and **0 admins**. The initial administrator is provisioned explicitly via `flask --app backend/wsgi.py create-admin` (reading from interactive prompt or `INITIAL_ADMIN_PASSWORD` env var).
   - Farmers are registered exclusively by authenticated admins or field officers up to the hard cap of `MAX_FARMERS=40` enforced inside a locked transaction (`BEGIN IMMEDIATE` on SQLite, `SELECT ... FOR UPDATE` / advisory lock on PostgreSQL).

3. **API Versioning & Backward Compatibility**:
   - All endpoints are served under `/api/v1/*` with consistent JSON envelopes and `X-Request-ID` tracing headers.
   - Legacy unversioned routes (`/api/health`, `/api/auth/login`, etc.) are aliased to `/api/v1/*` handlers where appropriate so existing bookmarks continue functioning smoothly, and documented in `CHANGELOG.md`.

4. **Password Hashing & Field-Level Encryption**:
   - Passwords use Argon2id (`argon2-cffi`) with automatic fallback to OWASP-compliant `hashlib.scrypt` (`N=16384, r=8, p=1`) if host Windows Application Control policies block native CFFI DLLs.
   - Sensitive PII columns (`mobile_encrypted`, `survey_no_encrypted`) are encrypted at rest using authenticated symmetric encryption derived from `FIELD_ENCRYPTION_KEY` (or `FLASK_SECRET_KEY` in development).

5. **DPDP Act 2023 Compliance (`needs_legal_review`)**:
   - The Privacy Notice, Terms of Use, and First-Login Consent Screen in Marathi, Hindi, and English are aligned with India's Digital Personal Data Protection (DPDP) Act 2023 (explicit consent, purpose limitation, data minimization, right to export, and right to erasure).
   - **Note (`needs_legal_review`)**: Legal text in `frontend/src/components/LegalModals.tsx` is marked `needs_legal_review` in this internal documentation and should be reviewed by qualified legal counsel prior to public statutory filing.

6. ** Native Translation Review (`needs_native_review`)**:
   - Marathi (`mr`) and Hindi (`hi`) agricultural and consent translations follow Grade-4 readability guidelines and MPKV Rahuri terminology, and are flagged `needs_native_review` here for extension officer sign-off.
