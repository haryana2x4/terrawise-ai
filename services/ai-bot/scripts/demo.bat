@echo off
title SUNDAY v2 - Live 90s Hackathon Demo
echo ========================================================
echo   SUNDAY v2: The Living Companion (Demo Mode)
echo   100%% Local-First, Offline AI Assistant with 3D Body
echo ========================================================
echo.
echo [1/3] Pre-warming event bus and local neural models...
echo [2/3] Starting Local Server on http://127.0.0.1:8765...
start /b node server.js
timeout /t 2 /nobreak >nul
echo [3/3] Launching World-Class Studio in Chrome/Default Browser...
start http://127.0.0.1:8765
echo.
echo SUNDAY v2 is LIVE! Press Ctrl+C in this window to stop.
echo.
pause
