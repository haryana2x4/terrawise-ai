# Known Issues (Observed in Unmodified Project Code)

Per Rule 3 (*"Do not fix, refactor or rename any project code. Only add upload files (.gitignore, .gitattributes, LICENSE, README, .env.example, docs). If something looks broken, list it in docs/known-issues.md"*), all project source code was preserved verbatim without refactoring. The following known issues were identified during inspection:

1. **Missing `requirements.txt` in `backend/`**:
   - The Python backend does not include a pinned `requirements.txt` file in the original source.
   - **Workaround**: Install the required packages directly:
     ```bash
     pip install flask flask-cors sqlalchemy argon2-cffi shapely pyproj qrcode reportlab pillow requests
     ```
2. **Regenerating Demo Parcel Boundaries (`data/geo/fields.geojson`)**:
   - `data/geo/fields.geojson` is excluded from Git tracking per Rule 1.2 / 1.4 (farmer parcel data exclusion).
   - **Workaround**: Before running `tests/test_geo.py` or seeding demo parcels into SQLite, run:
     ```bash
     python backend/generate_fields.py
     ```
3. **Hard-Coded Port `5000` in `backend/app.py`**:
   - Line 569 of `backend/app.py` calls `app.run(host="127.0.0.1", port=5000, debug=False)` without reading `os.environ.get("PORT")`.
4. **Hard-Coded Desktop Output Path in `modules/orien/scripts/make-standalone-html.mjs`**:
   - The post-build helper `make-standalone-html.mjs` in `modules/orien` references `C:\Users\Rocky\Desktop\Beyond Earth`. Running `npx vite build` (or `node scripts/build.mjs`) inside `modules/orien` builds `dist/` cleanly without invoking the Desktop copy script.
5. **RAG Filename Mismatch in `services/ai-bot/tests/smoke_test.js`**:
   - `smoke_test.js` asserts `ragResult.source === 'security_audit.log'`, whereas `core/tools.js` returns `'security_governance.md'` for the query `'security policy'` (16/17 smoke assertions pass).
6. **Python 3.12 `datetime.utcnow()` Deprecation Warnings**:
   - `backend/models.py`, `backend/data_pipeline.py`, `backend/database.py`, and `backend/advice_engine.py` use `datetime.utcnow()`, which emits a `DeprecationWarning` on Python 3.12+ while remaining functionally operational (all 22 backend unit tests pass).
