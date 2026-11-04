@echo off
rem Builds Ruin with the supervisor's build script and opens it. Owned by the supervisor; the checker keeps it unchanged.
cd /d "%~dp0"
node tools\build.mjs || (pause & exit /b 1)
start "" "dist\index.html"
