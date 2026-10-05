@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node 18 or newer is required. Install it and run this file again.
  pause
  exit /b 1
)
echo Building the games and the menu...
node tools\build-site.mjs --serve 8080 --open
if errorlevel 1 (
  echo The build or the server failed. See the output above.
  pause
  exit /b 1
)
endlocal
