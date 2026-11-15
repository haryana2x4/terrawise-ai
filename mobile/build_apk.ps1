# Kshetra Android APK Build Script (Windows PowerShell)
param(
    [string]$ApiBaseUrl = "http://10.0.2.2:5000",
    [switch]$Release
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $RepoRoot "frontend"
$MobileDir = $PSScriptRoot
$AndroidDir = Join-Path $MobileDir "android"
$ReleaseDir = Join-Path $RepoRoot "release"

Write-Host "[1/5] Checking Android SDK / Java toolchain..." -ForegroundColor Cyan
if (-not $env:ANDROID_HOME -and (Test-Path "$env:LOCALAPPDATA\Android\Sdk")) {
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
}
if (-not $env:ANDROID_HOME) {
    Write-Error @"
Android SDK not found on this PC.
Install Android Studio (https://developer.android.com/studio) and SDK Platform + Build-Tools,
then set ANDROID_HOME (for example `$env:LOCALAPPDATA\Android\Sdk) and re-run mobile/build_apk.ps1.

Tip: Farmers on Android phones can ALREADY install Kshetra right now without waiting for an .apk:
open Chrome on HTTPS or scan the QR code in 'Install / Share App' -> Install app (WebAPK).
"@
}

Write-Host "[2/5] Building Kshetra production React bundle..." -ForegroundColor Cyan
Push-Location $FrontendDir
$env:VITE_API_BASE_URL = $ApiBaseUrl
npm run build
Pop-Location

Write-Host "[3/5] Installing Capacitor dependencies and preparing Android project..." -ForegroundColor Cyan
Push-Location $MobileDir
if (-not (Test-Path (Join-Path $MobileDir "node_modules"))) {
    npm install
}
if (-not (Test-Path $AndroidDir)) {
    npx cap add android
}
npx cap sync android
Pop-Location

$ManifestPath = Join-Path $AndroidDir "app\src\main\AndroidManifest.xml"
if (Test-Path $ManifestPath) {
    $Manifest = Get-Content $ManifestPath -Raw
    if ($Manifest -notmatch "ACCESS_FINE_LOCATION") {
        $Manifest = $Manifest -replace "<application", @"
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <application
"@
        Set-Content -Path $ManifestPath -Value $Manifest -Encoding UTF8
    }
}

Write-Host "[4/5] Compiling Android APK with Gradle..." -ForegroundColor Cyan
Push-Location $AndroidDir
if ($Release) {
    .\gradlew.bat assembleRelease
    $ApkSource = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release-unsigned.apk"
    $ApkTarget = Join-Path $ReleaseDir "Kshetra-release-unsigned.apk"
} else {
    .\gradlew.bat assembleDebug
    $ApkSource = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
    $ApkTarget = Join-Path $ReleaseDir "Kshetra-debug.apk"
}
Pop-Location

Write-Host "[5/5] Copying built APK to release/..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
Copy-Item -Path $ApkSource -Destination $ApkTarget -Force
Write-Host "APK built successfully: $ApkTarget" -ForegroundColor Green
