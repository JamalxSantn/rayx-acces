@echo off
echo ================================================
echo     Rayx Acces - VDS Deployment Helper
echo ================================================
echo.

echo This script will help you prepare files for VDS deployment.
echo.

:menu
echo Choose deployment type:
echo 1. Linux VDS (Ubuntu)
echo 2. Windows VDS
echo 3. Create deployment package (ZIP)
echo 4. Exit
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto linux
if "%choice%"=="2" goto windows
if "%choice%"=="3" goto package
if "%choice%"=="4" goto end
goto menu

:linux
echo.
echo ================================================
echo Linux VDS Deployment Steps:
echo ================================================
echo.
echo 1. Install Node.js on VDS:
echo    curl -fsSL https://deb.nodesource.com/setup_18.x ^| sudo -E bash -
echo    sudo apt-get install -y nodejs
echo.
echo 2. Install PM2:
echo    sudo npm install -g pm2
echo.
echo 3. Create directory:
echo    mkdir -p /opt/rayx-acces
echo.
echo 4. Copy this "rayx-acces" folder to VDS:
echo    scp -r "rayx-acces" root@YOUR_VDS_IP:/opt/rayx-acces/
echo.
echo 5. On VDS, run:
echo    cd /opt/rayx-acces
echo    npm install
echo    npm run build
echo    pm2 start server/src/index.js --name rayx-acces
echo    pm2 startup
echo    pm2 save
echo.
echo 6. Open firewall:
echo    sudo ufw allow 3001/tcp
echo.
echo For detailed guide, see: VDS_DEPLOYMENT.md
echo.
pause
goto menu

:windows
echo.
echo ================================================
echo Windows VDS Deployment Steps:
echo ================================================
echo.
echo 1. Install Node.js on VDS:
echo    Download from: https://nodejs.org/
echo    Install 64-bit version
echo.
echo 2. Copy this "rayx-acces" folder to VDS:
echo    Use RDP, FileZilla, or WinSCP
echo    Destination: C:\rayx-acces
echo.
echo 3. On VDS, open PowerShell and run:
echo    cd "C:\rayx-acces"
echo    npm install
echo    npm run build
echo    npm start
echo.
echo 4. Open firewall (PowerShell as Admin):
echo    New-NetFirewallRule -DisplayName "Rayx Acces" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
echo.
echo 5. Install NSSM for Windows Service (optional):
echo    Download from: https://nssm.cc/download
echo    nssm install RayxAcces
echo.
echo For detailed guide, see: VDS_WINDOWS_DEPLOYMENT.md
echo.
pause
goto menu

:package
echo.
echo Creating deployment package...
echo.

set OUTPUT_FILE=rayx-acces-deploy.zip

echo Checking for 7-Zip or PowerShell Compress-Archive...

where 7z >nul 2>&1
if %ERRORLEVEL%==0 (
    echo Using 7-Zip...
    7z a -tzip "%OUTPUT_FILE%" "server" "client" "bot" "package.json" "package-lock.json" "README.md"
) else (
    echo Using PowerShell Compress-Archive...
    powershell -Command "Compress-Archive -Path 'server','client','bot','package.json','package-lock.json','README.md' -DestinationPath '%OUTPUT_FILE%' -Force"
)

if exist "%OUTPUT_FILE%" (
    echo.
    echo ================================================
    echo Deployment package created: %OUTPUT_FILE%
    echo ================================================
    echo.
    echo You can now upload this file to your VDS and extract it.
    echo.
    echo On Linux VDS:
    echo   unzip %OUTPUT_FILE% -d /opt/rayx-acces
    echo.
    echo On Windows VDS:
    echo   Extract to: C:\rayx-acces
    echo.
) else (
    echo ERROR: Failed to create deployment package.
)

pause
goto menu

:end
echo.
echo ================================================
echo Deployment helper closed.
echo ================================================
echo.
echo Remember to:
echo 1. Update Auth_WinHTTP.cpp with your VDS IP
echo 2. Create discord_config.dat on client
echo 3. Set .env variables on VDS (JWT_SECRET, etc.)
echo.
echo Good luck! ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬
echo.
pause
exit
