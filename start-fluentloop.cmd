@echo off
setlocal
cd /d "%~dp0"
title FluentLoop Launcher

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [FluentLoop] Node.js was not found.
  echo Install Node.js 18 or newer, then run this file again.
  echo.
  pause
  exit /b 1
)

echo [FluentLoop] Checking the local service...
node scripts\launch-fluentloop.mjs
if errorlevel 1 (
  echo.
  echo [FluentLoop] Startup failed. See the message above.
  pause
  exit /b 1
)

echo [FluentLoop] Ready. You can close this window.
timeout /t 2 /nobreak >nul
exit /b 0
