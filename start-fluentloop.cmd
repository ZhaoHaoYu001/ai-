@echo off
cd /d "%~dp0"
title FluentLoop Local Server
echo Starting FluentLoop...
echo.
npm.cmd start
echo.
echo FluentLoop stopped. Press any key to close.
pause >nul
