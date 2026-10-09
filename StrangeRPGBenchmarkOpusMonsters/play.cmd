@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node 18 or newer is required. Install it and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)
echo Building Whorl...
call npm run build --silent
if errorlevel 1 goto :fail
echo Opening http://localhost:8743/
start "" http://localhost:8743/
node scripts\serve.mjs 8743
goto :eof
:fail
echo The build failed. See the output above.
pause
