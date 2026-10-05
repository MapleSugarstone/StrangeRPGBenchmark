@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto open
if not exist node_modules (
  echo Installing build tools...
  call npm install --no-audit --no-fund
)
echo Building...
call node build.mjs
if errorlevel 1 echo Build failed. Opening the last good build.
:open
if not exist dist\index.html (
  echo No build found. Install Node 18 or newer and run this file again.
  pause
  exit /b 1
)
start "" "%~dp0dist\index.html"
endlocal
