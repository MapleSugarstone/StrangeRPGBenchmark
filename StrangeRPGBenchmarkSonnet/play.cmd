@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install || goto :fail
)
echo Building game...
call node build.mjs game || goto :fail
echo Opening game in your browser.
start "" "%~dp0dist\index.html"
exit /b 0
:fail
echo Build failed.
pause
exit /b 1
