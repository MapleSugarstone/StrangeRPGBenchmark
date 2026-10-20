@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node 18 or newer is required. Install it and run this file again.
  pause
  exit /b 1
)
set "port=8137"
set "last="
start "Checksum server" /min node tools\serve.mjs %port%

:menu
cls
echo.
echo   CHECKSUM
echo.
node tools\serve.mjs --levels
echo.
echo   L  Play a level by number
echo   T  Title screen
echo   M  The ruins (overworld)
echo   O  Old test builds (Compile, Syntax, and Loop)
echo   Q  Quit and stop the server
echo.
if defined last (
  echo   Opened %last% in your browser.
  echo.
)
choice /c LTMOQ /n /m "  Pick one: "
set "k=%errorlevel%"
if "%k%"=="5" goto quit
if "%k%"=="4" (
  set "page=/prototypes/" & set "last=the old test builds"
  goto open
)
if "%k%"=="3" (
  set "page=/?world" & set "last=the ruins"
  goto open
)
if "%k%"=="2" (
  set "page=/" & set "last=the title screen"
  goto open
)

set "num="
set /p "num=  Level number: "
if not defined num goto menu
echo %num%| findstr /r "^[0-9][0-9]*$" >nul || goto menu
set "page=/?p=%num%" & set "last=level %num%"

:open
node tools\serve.mjs --open "%page%" %port%
goto menu

:quit
node tools\serve.mjs --stop %port%
endlocal
exit /b 0
