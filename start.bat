@echo off
title Rayx Acces - Production
cd /d "%~dp0"

echo ================================================
echo    Rayx Acces - PRODUCTION start (site + bot)
echo ================================================
echo.

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 goto :error

rem Match the native SQLite engine to THIS machine's Node.js version.
rem (Fixes "NODE_MODULE_VERSION" errors after copying the project between
rem  machines / Node versions, e.g. dev PC -> VDS.)
echo     - Matching the database engine to this Node.js version...
call npm rebuild better-sqlite3
if errorlevel 1 goto :error

echo.
echo [2/3] Building the web client...
call npm run build
if errorlevel 1 goto :error

echo.
echo [3/3] Starting the server + bot...
echo.
echo    Web panel + API : http://localhost:3001
echo    Close this window to stop everything.
echo.

rem Open the panel in the default browser once the server has had time to boot.
start "" cmd /c "timeout /t 5 >nul & explorer http://localhost:3001"

call npm run start:all
goto :eof

:error
echo.
echo *** Something went wrong. Read the messages above. ***
pause
