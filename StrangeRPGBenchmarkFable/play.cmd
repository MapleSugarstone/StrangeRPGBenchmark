@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)
echo Building...
call npm run build --silent
if errorlevel 1 goto :fail
echo Opening http://localhost:8642/
start "" http://localhost:8642/
node scripts\serve.mjs
goto :eof
:fail
echo Build failed. See output above.
pause
