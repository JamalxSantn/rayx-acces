@echo off
title Rayx Acces - Development
cd /d "%~dp0"

echo ================================================
echo    Rayx Acces - DEVELOPMENT start (for testing)
echo    site + client + bot, with live reload
echo ================================================
echo.

echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 goto :error

rem Match the native SQLite engine to THIS machine's Node.js version.
echo     - Matching the database engine to this Node.js version...
call npm rebuild better-sqlite3
if errorlevel 1 goto :error

echo.
echo [2/2] Starting server + client + bot in dev mode...
echo.
echo    Web client : http://localhost:5173
echo    API        : http://localhost:3001
echo    Close this window to stop everything.
echo.

rem Open the dev client once Vite has had time to boot.
start "" cmd /c "timeout /t 6 >nul & explorer http://localhost:5173"

call npm run dev:all
goto :eof

:error
echo.
echo *** Something went wrong. Read the messages above. ***
pause
