# Security Architecture & DPDP Act 2023 Compliance (`SECURITY.md`)

## 1. Authentication & Session Security

- **Password Hashing**: Passwords are hashed using **Argon2id** (`argon2-cffi`, `memory_cost=32768`, `time_cost=2`) with automatic fallback to **OWASP PBKDF2-HMAC-SHA256** (`600,000` iterations, 16-byte random salt).
- **Brute-Force Lockout**: Accounts are automatically locked for 15 minutes (`HTTP 423 ACCOUNT_LOCKED`) after 5 consecutive failed login attempts. IP-based sliding-window rate limiting (`RateLimiter`) blocks credential stuffing (`HTTP 429`).
- **Short-Lived Access Tokens & Rotating Refresh Tokens**:
  - Access tokens are signed with `HS256` (`JWT_SECRET_KEY`) and expire after 30 minutes.
  - Refresh tokens are stored only as `SHA-256` hashes in the `refresh_tokens` table, grouped by `family_id`.
  - **Token Reuse Detection**: If a previously rotated (`revoked=True`) refresh token is presented again, Kshetra immediately revokes the **entire token family** (`HTTP 401 REFRESH_TOKEN_REUSE`).

---

## 2. Object-Level Authorization (IDOR Prevention)

- Every parcel, crop history entry, field observation, assistant conversation, and credential card route calls `check_object_ownership(owner_farmer_id)`.
- A farmer can only read or mutate resources belonging to their own `farmer_id`. Attempting to access another farmer's resource returns `HTTP 403 FORBIDDEN_OWNERSHIP`.

---

## 3. Encryption at Rest & Secret Hygiene

- **Field-Level Encryption**: Sensitive PII fields (`Farmer.mobile_encrypted` and `Parcel.survey_number_encrypted`) are encrypted at rest using authenticated encryption (`Encrypt-then-MAC` with `SHA-256 CTR` + `HMAC-SHA256` tag derived from `SECRET_KEY`).
- **Zero Client-Side Secrets**: All external API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `AGMARKNET_API_KEY`) live strictly in server environment variables and never appear in the frontend bundle.

---

## 4. SSRF & XXE Protection

- **Outbound Host Allowlist**: `validate_outbound_url()` restricts all backend HTTP calls to an explicit allowlist (`api.open-meteo.com`, `power.larc.nasa.gov`, `rest.isric.org`, `api.data.gov.in`, `generativelanguage.googleapis.com`, `api.openai.com`). Any other host or scheme is blocked (`HTTP 403 SSRF_BLOCKED`).
- **Safe Boundary Imports**: KML and GeoJSON uploads are capped at 2 MB and reject XML `<!DOCTYPE` / `<!ENTITY` declarations (`HTTP 400 XXE_BLOCKED`).

---

## 5. India DPDP Act 2023 Compliance

- **Informed Consent**: On first login, farmers are shown a clear Marathi/Hindi/English data usage notice and must accept before continuing (`POST /api/v1/auth/consent`, recorded in `Farmer.consent_accepted_at`).
- **Right to Data Portability**: Farmers can download a complete JSON archive of their profile, parcels, observations, and assistant history at any time via `GET /api/v1/farmers/me/export`.
- **Right to Erasure ("Delete My Data")**: Farmers can permanently erase their account, parcels, observations, and chat history via `DELETE /api/v1/farmers/me`, which also records an immutable compliance entry in `AuditLog`.
