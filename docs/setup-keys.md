# API Keys Setup, Configuration & Budgeting Guide
*TERRAWISE AI Pilot Infrastructure Setup*

This document provides step-by-step instructions to procure, configure, restrict, and safeguard all external API keys used across the platform.

---

## 1. Google Maps JavaScript API (Optional Enhanced Satellite Layer)

The platform provides a high-performance built-in Leaflet + OpenStreetMap + NASA GIBS satellite fallback. To enable proprietary Google Satellite Tiles:

### Step 1: Create a Google Cloud Project
1. Log in to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a Project** > **New Project**, name it `terrawise-ai-pilot`, and click **Create**.

### Step 2: Enable the Maps JavaScript API
1. Navigate to **APIs & Services** > **Library**.
2. Search for `Maps JavaScript API`.
3. Select it and click **Enable**.

### Step 3: Create and Restrict the API Key
1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** > **API Key**.
3. Under **Application restrictions**, choose **Websites** and add your production domain or development origins:
   - `http://localhost:5173/*`
   - `http://127.0.0.1:5000/*`
4. Under **API restrictions**, select **Restrict key** and choose only **Maps JavaScript API**.
5. Save the key as `VITE_GOOGLE_MAPS_KEY` in `.env`.

### Step 4: Budget Alerts
1. Go to **Billing** > **Budgets & alerts**.
2. Set a maximum monthly threshold of \$10 with email triggers at 50%, 80%, and 100%. (Google provides \$200 monthly free tier credit).

---

## 2. Agmarknet / data.gov.in API Key (Live Mandi Prices)

Used to fetch daily mandi arrival rates from Lasalgaon, Pimpalgaon Baswant, Rahuri, and Nashik APMCs.

### Step 1: Register on Open Government Data (OGD) Platform India
1. Visit [data.gov.in](https://data.gov.in/) and click **Register**.
2. Sign up with your official mobile number and email.

### Step 2: Generate API Key
1. Once logged in, navigate to **My Account** > **API Key Generator**.
2. Copy your 32-character API key.
3. Save as `DATA_GOV_IN_API_KEY` in `.env`.

---

## 3. Copernicus Data Space Ecosystem (CDSE / Sentinel-2 NDVI)

Used for optional high-resolution 10-meter polygon zonal vegetation indexing.

### Step 1: Create an EU Copernicus Account
1. Visit [dataspace.copernicus.eu](https://dataspace.copernicus.eu/) and click **Register**.
2. Accept the EU Copernicus open access terms.

### Step 2: Generate OAuth Client Credentials
1. Navigate to the **User Profile** > **API Keys / OAuth Clients**.
2. Click **Create New Client**.
3. Record `COPERNICUS_CLIENT_ID` and `COPERNICUS_CLIENT_SECRET` in `.env`.

---

## 4. Open-Meteo & NASA POWER (No Keys Required)

Both Open-Meteo and NASA POWER operate under public-domain open access policies:
- **Open-Meteo:** No API key required; rate-limited to 10,000 calls/day. Attribution requirement met on all UI components (`Source: Open-Meteo (CC BY 4.0)`).
- **NASA POWER:** No API key required. Maintained by NASA Langley Research Center.
