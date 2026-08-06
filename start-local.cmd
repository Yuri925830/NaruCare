@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is required. Reinstall Node.js with npm, then run this file again.
  pause
  exit /b 1
)

call npm run local
if errorlevel 1 (
  echo.
  echo NaruCare did not start. Review the error above.
  pause
  exit /b 1
)
