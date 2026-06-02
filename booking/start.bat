@echo off
title Classroombookings Node.js - PM2 Starter
echo ===================================================
echo   Classroombookings Node.js - PM2 Starter 2026
echo ===================================================
echo.

:: Wechselt automatisch in das Verzeichnis dieser Batch-Datei
cd /d "%~dp0"

echo [1/2] Starte Node.js Belegungssystem in PM2...
call pm2 start ecosystem.config.js

echo.
echo [2/2] Oeffne SSO Test-Tool im Browser...
timeout /t 2 >nul
start http://localhost:8000/test_sso.php

echo.
echo ===================================================
echo   System erfolgreich in PM2 gestartet!
echo   Sie koennen dieses Fenster jetzt schliessen.
echo ===================================================
timeout /t 5
