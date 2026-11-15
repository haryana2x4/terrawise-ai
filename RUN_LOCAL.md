# Running Kshetra Locally (VS Code, Antigravity IDE & Windows PowerShell)

All scripts and IDE launch configurations are Windows-safe and require zero manual setup beyond Python and Node.js.

---

## Quick Start: VS Code & Antigravity IDE (One-Click F5)

1. Open the repository folder `terrawise-ai` (or open `kshetra.code-workspace`) in **VS Code** or **Antigravity IDE**.
2. Press **F5** (or open the **Run and Debug** sidebar and select **Kshetra: Run Full Stack (One-Click F5)**).
   - `start.py` automatically creates `.env` with freshly generated local keys (never hardcoded), installs missing backend/frontend dependencies, initializes the database, starts both the Flask backend (`http://127.0.0.1:5000`) and Vite frontend (`http://127.0.0.1:5173`), and opens Kshetra in your browser.
   - To debug Python routes with breakpoints alongside Vite, select **Kshetra: Debug Backend + Frontend (Full Stack)**.
   - Use **Terminal -> Run Task...** for built-in shortcuts (`Setup & Bootstrap Check`, `Create Initial Admin (CLI)`, `System Doctor Check`, `Verify All`).
3. To create your first administrator account, run from the integrated terminal (or the **Create Initial Admin (CLI)** task):

```powershell
cd backend
python -m flask --app wsgi create-admin --admin-id ADMIN --name "Kshetra Agricultural Officer"
```

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

---

## 6. Reach Kshetra From Phones & Install / Download the App

1. **Share on Wi-Fi / Same Network (Single-Port Waitress Server)**:
   - Double-click **`share_app.bat`** (or run `python start.py --share --prod`).
   - It builds `frontend/dist`, binds Waitress WSGI on `0.0.0.0:5000`, and prints the live **Wi-Fi / Phone URL** (`http://<YOUR-LAN-IP>:5000`).
2. **Public Internet Access (HTTPS Anywhere)**:
   - Install Cloudflare Tunnel and run `cloudflared tunnel --url http://127.0.0.1:5000` (optionally set `KSHETRA_PUBLIC_URL=<your-https-url>` in `.env`).
3. **Install / Download Inside the App**:
   - Click **अ‍ॅप डाउनलोड (Get App)** on Login, **अ‍ॅप घ्या (Install)** in the top bar, or **शेअर / QR अ‍ॅप** in the Admin Header to:
     - Install natively as a standalone **PWA** on Android Chrome/Edge or Windows/macOS Desktop (`manifest.webmanifest` + Service Worker offline shell).
     - Scan the live SVG **QR Code** (`/api/v1/meta/access-qr`) to open Kshetra directly on nearby mobile phones.
     - Download **`Kshetra-App.bat`** (`/api/v1/meta/download/windows-launcher`) for a standalone desktop window on Windows PCs.
