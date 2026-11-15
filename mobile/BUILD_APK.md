# Building the Kshetra Android `.apk`

Kshetra ships with two Android installation paths:

1. **Instant Android WebAPK (works immediately, zero SDK required)**  
   Open Kshetra on Android Chrome over HTTPS (e.g. via Cloudflare Tunnel: `cloudflared tunnel --url http://127.0.0.1:5000`) and tap **Install App** in the top bar or Chrome menu (`Add to Home screen`). Android generates a native signed WebAPK with fullscreen UI and app icon.

2. **Standalone `.apk` Binary via Capacitor (`mobile/build_apk.ps1`)**  
   Use this when you want a sideloadable `.apk` file (`release/Kshetra-debug.apk` or signed release `.apk`) or Play Store `.aab`:
   - Install **Android Studio** (includes Android SDK Platform & Build-Tools) and **JDK 17+**.
   - Ensure `$env:ANDROID_HOME` points to `%LOCALAPPDATA%\Android\Sdk`.
   - From PowerShell in the repo root, pass your live hosted/LAN API URL:
     ```powershell
     .\mobile\build_apk.ps1 -ApiBaseUrl "https://your-kshetra-server.example.com"
     ```
   - Output is written to `release/Kshetra-debug.apk` (or `-Release` for `Kshetra-release-unsigned.apk`, ready for `apksigner`).

   `build_apk.ps1` automatically injects `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `RECORD_AUDIO`, and `MODIFY_AUDIO_SETTINGS` into `AndroidManifest.xml` so parcel GPS mapping and trilingual Krishi Mitra voice mode work inside the Android WebView.
