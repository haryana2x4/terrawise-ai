# Running Kshetra Locally (Windows PowerShell)

All commands below are native Windows PowerShell commands. No bash-only scripts are required.

---

## 1. Prerequisites

- **Python 3.11+** (`python --version`)
- **Node.js 20+** (`node --version` & `npm --version`)

---

## 2. Backend Setup & Initial Administrator Creation

Open PowerShell in the repository root (`terrawise-ai`):

```powershell
# 1. Install Python dependencies
cd backend
python -m pip install -r requirements.txt

# 2. Verify system readiness (database ping, geo boundaries, crops catalog, Devanagari fonts)
$env:FLASK_APP = "wsgi.py"
python -m flask doctor

# 3. Create the initial Administrator account (no accounts are auto-seeded)
python -m flask create-admin --admin-id ADMIN --name "Kshetra Agricultural Officer"

# 4. Start the backend API server on http://localhost:5000
python wsgi.py
```

---

## 3. Frontend Setup & Development Server

Open a second PowerShell window in `terrawise-ai`:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser and sign in with `ADMIN` and the password you set in step 2.

---

## 4. Onboarding Your First Farmer & Printing Credential Cards

1. Sign in as `ADMIN` to open the **Agricultural Officer Command Center**.
2. Click **नवीन शेतकरी जोडा (Add Farmer)** and enter the farmer's name, district (`Ahilya Nagar` or `Nashik`), taluka, and village.
3. Kshetra atomically reserves a slot (`1 of 20`), generates a unique Farmer ID (e.g., `KS-482910`) and a pronounceable natural password (e.g., `Banyan-Godavari-Lotus-42`).
4. Click the **Print (A6 PDF)** icon next to the farmer to download their printable Devanagari credential card.
5. When the farmer signs in for the first time, Kshetra presents the **DPDP Act 2023 Privacy Consent** notice and prompts them to set their own private password.

---

## 5. Running Verification & Guard Checks

```powershell
# Run the zero-demo guard script
python scripts/check_no_demo.py

# Run the backend automated test suite
cd backend
python -m pytest -v

# Run frontend TypeScript check and production build
cd ../frontend
npx tsc --noEmit
npm run build
```
