@echo off
:: ============================================================
::   SAI LOUNGE POS - INSTALLER
::   MUST be run as Administrator.
:: ============================================================
setlocal EnableDelayedExpansion

title Sai Lounge POS Installer
mode con: cols=80 lines=45
color 0B

:: ============================================================
:: STEP 0 - Admin privilege check
:: ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  +----------------------------------------------------------+
    echo  ^|  ERROR: This installer must be run as Administrator.     ^|
    echo  ^|  Right-click the file and choose "Run as administrator". ^|
    echo  +----------------------------------------------------------+
    echo.
    pause
    exit /b 1
)

:: ============================================================
:: BANNER - SIMPLE VERSION (NO ASCII ART)
:: ============================================================
cls
color 0B
echo.
echo  ================================================================
echo.
echo            S A I   L O U N G E   P O S   S Y S T E M
echo.
echo  ================================================================
echo.
color 0F
echo   Sai Lounge POS - Installer v2.0
echo   Installing to: C:\Program Files\Sai Lounge POS
echo.
color 0B
echo  ================================================================
echo.
timeout /t 2 /nobreak >nul

:: ============================================================
:: STEP 1 - Check Node.js
:: ============================================================
echo [STEP 1] Checking Node.js installation...

where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERROR: Node.js is NOT installed on this computer.
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/en/download
    echo.
    echo After installing Node.js, run this installer again.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>nul') do echo Node.js found: %%v
for /f "tokens=*" %%v in ('npm --version 2^>nul') do echo npm found: v%%v
echo.

:: ============================================================
:: STEP 2 - Locate source files
:: ============================================================
echo [STEP 2] Locating source files...

set "SCRIPT_DIR=%~dp0"
if "!SCRIPT_DIR:~-1!"=="\" set "SCRIPT_DIR=!SCRIPT_DIR:~0,-1!"

set "SRC_BACKEND=!SCRIPT_DIR!\backend"
set "SRC_FRONTEND=!SCRIPT_DIR!\frontend"

if not exist "!SRC_BACKEND!\server.js" (
    echo ERROR: backend\server.js not found next to this installer.
    pause
    exit /b 1
)

if not exist "!SRC_FRONTEND!\package.json" (
    echo ERROR: frontend\package.json not found next to this installer.
    pause
    exit /b 1
)

echo Backend source found
echo Frontend source found
echo.

:: ============================================================
:: STEP 3 - Create installation directory
:: ============================================================
echo [STEP 3] Creating installation directory...

set "INSTALL_DIR=C:\Program Files\Sai Lounge POS"
set "BACKEND_DIR=!INSTALL_DIR!\backend"

if exist "!INSTALL_DIR!" (
    echo WARNING: Installation folder already exists.
    echo Existing files will be updated.
    echo.
)

mkdir "!INSTALL_DIR!" 2>nul
mkdir "!BACKEND_DIR!" 2>nul
mkdir "!BACKEND_DIR!\public" 2>nul
echo Installation directory ready
echo.

:: ============================================================
:: STEP 4 - Copy files
:: ============================================================
echo [STEP 4] Copying application files...

echo Copying backend files...
xcopy "!SRC_BACKEND!" "!BACKEND_DIR!" /E /I /Y /Q >nul
echo Backend files copied

echo Copying frontend build...
if exist "!SRC_FRONTEND!\build" (
    xcopy "!SRC_FRONTEND!\build" "!BACKEND_DIR!\public" /E /I /Y /Q >nul
    echo Frontend build copied
) else (
    echo WARNING: Frontend build not found. Run npm run build first.
)
echo.

:: ============================================================
:: STEP 5 - Copy images
:: ============================================================
echo [STEP 5] Copying images...

if exist "!SRC_FRONTEND!\src\assets\logo.jpeg" (
    copy "!SRC_FRONTEND!\src\assets\logo.jpeg" "!BACKEND_DIR!\public\" >nul
    echo Logo copied
)

if exist "!SRC_FRONTEND!\src\assets\bg.png" (
    copy "!SRC_FRONTEND!\src\assets\bg.png" "!BACKEND_DIR!\public\" >nul
    echo Background image copied
)
echo.

:: ============================================================
:: STEP 6 - Windows Firewall rule
:: ============================================================
echo [STEP 6] Configuring Windows Firewall...

netsh advfirewall firewall delete rule name="Sai Lounge POS" >nul 2>&1
netsh advfirewall firewall add rule name="Sai Lounge POS" dir=in action=allow protocol=TCP localport=3001 >nul

if %errorlevel% equ 0 (
    echo Firewall rule added for port 3001
) else (
    echo WARNING: Could not add firewall rule automatically
)
echo.

:: ============================================================
:: STEP 7 - Create start.bat
:: ============================================================
echo [STEP 7] Creating start script...

(
echo @echo off
echo color 0A
echo echo ========================================
echo echo    STARTING SAI LOUNGE POS
echo echo ========================================
echo echo.
echo cd /d "!BACKEND_DIR!"
echo echo Server starting on port 3001...
echo echo.
echo node server.js
echo pause
) > "!INSTALL_DIR!\start.bat"

echo Start script created
echo.

:: ============================================================
:: STEP 8 - Create desktop shortcut
:: ============================================================
echo [STEP 8] Creating desktop shortcut...

powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%USERPROFILE%\Desktop\Sai Lounge POS.lnk'); $SC.TargetPath = '!INSTALL_DIR!\start.bat'; $SC.Save()" >nul

echo Desktop shortcut created
echo.

:: ============================================================
:: DONE
:: ============================================================
color 0A
echo.
echo  ================================================================
echo    INSTALLATION COMPLETE!
echo  ================================================================
echo.
color 0F
echo   Installed to: !INSTALL_DIR!
echo.
echo   To start the POS:
echo     - Double-click "Sai Lounge POS" on your Desktop
echo.
echo   Login Codes:
echo     Admin    : 4000
echo     Cashier  : 2000
echo     Kitchen  : 3000
echo     Waiters  : 1001, 1002, 1003
echo.
echo   Access from tablets/phones on same WiFi:
echo     Run SHOW-IP.bat to get your address
echo.
color 0B
echo  ================================================================
echo.
pause
exit /b 0