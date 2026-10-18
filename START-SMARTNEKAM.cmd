@echo off
setlocal
cd /d "%~dp0"
title SmartNekam - Start App

echo.
echo ==============================================
echo   SMARTNEKAM - STARTUP
 echo ==============================================
echo.
echo Project folder: %CD%

if not exist "package.json" (
  echo ERROR: package.json haipo kwenye folda hii.
  echo Fungua START-SMARTNEKAM.cmd ndani ya SmartNekam_App_Source.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js na npm havijaonekana. Sakinisha Node.js LTS kwanza.
  pause
  exit /b 1
)

if not exist ".env.local" (
  copy ".env.example" ".env.local" >nul
  echo .env.local imeundwa kutoka .env.example.
  echo Fungua .env.local na ujaze Supabase URL pamoja na anon key halisi.
  echo Hifadhi faili, kisha endesha START-SMARTNEKAM.cmd tena.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Inasakinisha dependencies za SmartNekam. Subiri...
  call npm ci
  if errorlevel 1 (
    echo ERROR: npm ci imeshindwa. Kagua mtandao na ujumbe ulio juu.
    pause
    exit /b 1
  )
)

echo.
echo Inaandaa SmartNekam. Ukiona Local URL, fungua kwenye browser.
echo Simamisha server kwa Ctrl+C.
echo.
call npm run dev
pause
