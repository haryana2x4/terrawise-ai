@echo off
title SUNDAY v2 - One-Click Environment Setup
echo ========================================================
echo   Setting up SUNDAY v2 Dependencies
echo ========================================================
echo [1/2] Installing Node.js packages (Three.js, ws)...
call npm install
echo [2/2] Running automated smoke tests...
node tests/smoke_test.js
echo.
echo ========================================================
echo   Setup Complete! Run scripts\demo.bat to launch.
echo ========================================================
pause
