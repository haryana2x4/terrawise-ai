@echo off
title Kshetra - Share & Host Server (LAN + PWA Ready)
cd /d "%~dp0"
echo Starting Kshetra Single-Port Production Server on LAN (Port 5000)...
python start.py --share --prod
pause
