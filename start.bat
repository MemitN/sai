@echo off
:: ============================================================
::   SAI LOUNGE POS - START SERVER
::   Starts the Node.js backend, checks health, then opens
::   the browser automatically.
::   Can be run as a normal user (no Admin needed).
:: ============================================================
setlocal EnableDelayedExpansion

title  Sai Lounge POS  ^|  Starting...
mode con: cols=80 lines=50
color 0B

:: ============================================================
:: BANNER
:: ============================================================
cls
color 0B
echo.
echo  ================================================================
echo    ____    _    ___   _     ___  _   _ _   _  ____ _____
echo   / ___|  / \  ^|_ _^| ^| ^|   / _ \^| ^| ^| ^| \ ^| ^|/ ___^| ____|
echo   \___ \ / _ \  ^| ^|  ^| ^|  ^| ^| ^| ^| ^| ^| ^|  \^| ^| ^|  _^|  _^|
echo    ___) / ___ \ ^| ^|  ^| ^|__^| ^|_^| ^| ^|_^| ^| ^|\  ^| ^|_^| ^| ^|___
echo   ^|____/_/   \_\___^| ^|_____\___/ \___/^|_^| \_^\____^|_____|
echo.
echo                  P O S   S Y S T E M
echo  ================================================================
color 0F
echo.

:: ============================================================
:: Determine install dir
:: ============================================================
:: If run from the install folder use that; else check Program Files
set "INSTALL_DIR=%~dp0"
if "!INSTALL_DIR:~-1!"=="\" set "INSTALL_DIR=!INSTALL_DIR:~0,-1!"

set "BACKEND_DIR=!INSTALL_DIR!\backend"

:: Fallback to default Program Files location
if not exist "!BACKEND_DIR!\server.js" (
    set "INSTALL_DIR=C:\Program Files\Sai Lounge POS"
    set "BACKEND_DIR=!INSTALL_DIR!\backend"
)

if not exist "!BACKEND_DIR!\server.js" (
    color 0C
    echo   [ERROR]  Cannot find server.js.
    echo   Expected: !BACKEND_DIR!\server.js
    echo.
    echo   Make sure Sai Lounge POS is installed first (run install.bat).
    echo.
    color 0F
    pause
    exit /b 1
)

set "LOGFILE=!BACKEND_DIR!\server.log"

:: ============================================================
:: STEP 1 - Check for existing Node processes
:: ============================================================
color 0D
echo  ----------------------------------------------------------------
echo   [STEP 1]  Checking for existing Node.js processes
echo  ----------------------------------------------------------------
color 0F
echo.

tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorlevel% equ 0 (
    color 0E
    echo   WARNING: Node.js is already running on this computer.
    echo   Another instance may be using port 3001.
    echo.
    color 0F
    set /p KILLNODE="   Kill existing Node processes and restart fresh? (Y/N): "
    echo.
    if /i "!KILLNODE!"=="Y" (
        echo   Stopping existing Node.js processes...
        taskkill /F /IM node.exe >nul 2>&1
        timeout /t 2 /nobreak >nul
        color 0A
        echo   [OK]  Node.js processes stopped.
        color 0F
    ) else (
        color 0E
        echo   Continuing without killing existing processes.
        echo   The server may fail to start if port 3001 is already in use.
        color 0F
    )
) else (
    color 0A
    echo   [OK]  No existing Node.js processes found.
    color 0F
)
echo.

:: ============================================================
:: STEP 2 - Get local IP address
:: ============================================================
color 0D
echo  ----------------------------------------------------------------
echo   [STEP 2]  Detecting local IP address
echo  ----------------------------------------------------------------
color 0F
echo.

:: Use PowerShell to get IPv4 LAN address (skip loopback and APIPA)
for /f "tokens=*" %%i in ('powershell -NoProfile -Command ^
    "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown'} | Select-Object -First 1).IPAddress" ^
    2^>nul') do set "LOCAL_IP=%%i"

if "!LOCAL_IP!"=="" (
    :: Fallback using ipconfig parsing
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
        set "RAW=%%a"
        set "RAW=!RAW: =!"
        if "!RAW:~0,3!" neq "127" (
            if "!LOCAL_IP!"=="" set "LOCAL_IP=!RAW!"
        )
    )
)

if "!LOCAL_IP!"=="" set "LOCAL_IP=localhost"

color 0A
echo   [OK]  Local IP: !LOCAL_IP!
color 0F
echo.

:: ============================================================
:: STEP 3 - Start the Node.js server
:: ============================================================
color 0D
echo  ----------------------------------------------------------------
echo   [STEP 3]  Starting Sai Lounge POS server
echo  ----------------------------------------------------------------
color 0F
echo.

cd /d "!BACKEND_DIR!"

:: Rotate old log
if exist "!LOGFILE!" (
    copy /Y "!LOGFILE!" "!LOGFILE!.bak" >nul 2>&1
    del /F "!LOGFILE!" >nul 2>&1
)

:: Start Node in a new window so it keeps running after this script opens browser
echo   Launching server (Node.js)...
start "Sai Lounge POS - Server" /MIN cmd /c "cd /d "!BACKEND_DIR!" && node server.js > "!LOGFILE!" 2>&1"

echo.
echo   Waiting for server to initialise...

:: ============================================================
:: STEP 4 - Health check (retry up to 12 times = ~60 seconds)
:: ============================================================
color 0D
echo  ----------------------------------------------------------------
echo   [STEP 4]  Health check on port 3001
echo  ----------------------------------------------------------------
color 0F
echo.

set RETRY=0
set SERVER_UP=0
:healthloop
timeout /t 5 /nobreak >nul
set /a RETRY+=1

:: Try to reach the server using PowerShell's Invoke-WebRequest
powershell -NoProfile -Command ^
    "try { $r=(Invoke-WebRequest -Uri 'http://localhost:3001' -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop).StatusCode; exit 0 } catch { exit 1 }" ^
    >nul 2>&1

if %errorlevel% equ 0 (
    set SERVER_UP=1
    goto :healthdone
)

:: Also try a TCP connect as a lighter check
powershell -NoProfile -Command ^
    "try { $t=New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',3001); $t.Close(); exit 0 } catch { exit 1 }" ^
    >nul 2>&1

if %errorlevel% equ 0 (
    set SERVER_UP=1
    goto :healthdone
)

color 0E
echo   Attempt !RETRY!/12 - server not yet ready... waiting 5 seconds
color 0F

if !RETRY! lss 12 goto :healthloop

:healthdone
echo.

if "!SERVER_UP!"=="1" (
    color 0A
    echo   [OK]  Server is UP and responding on port 3001!
    color 0F
) else (
    color 0C
    echo   [ERROR]  Server did not respond after 60 seconds.
    echo.
    echo   Last lines from server.log:
    echo  ----------------------------------------------------------------
    if exist "!LOGFILE!" (
        powershell -NoProfile -Command "Get-Content '!LOGFILE!' -Tail 20"
    ) else (
        echo   (No log file found)
    )
    echo  ----------------------------------------------------------------
    echo.
    color 0E
    echo   Common causes:
    echo     - npm install was not run  (run install.bat again)
    echo     - Port 3001 is blocked by another application
    echo     - Missing .env file in backend folder
    echo.
    color 0F
    pause
    exit /b 1
)
echo.

:: ============================================================
:: STEP 5 - Display access information
:: ============================================================
title  Sai Lounge POS  ^|  RUNNING on port 3001

color 0B
echo  ================================================================
echo    SAI LOUNGE POS IS RUNNING
echo  ================================================================
echo.
color 0A
echo   Access from THIS computer:
color 0F
echo     http://localhost:3001
echo.
color 0A
echo   Access from OTHER devices on the same WiFi / LAN:
color 0F
echo     http://!LOCAL_IP!:3001
echo.
color 0D
echo   *** Staff Login Codes ***
color 0F
echo.
echo     Role        Code
echo     ----------  ----
echo     Admin       4000
echo     Cashier     2000
echo     Kitchen     3000
echo     Waiters     1001
echo.
color 0B
echo  ================================================================
echo.
color 0F
echo   The server window is running minimised in the taskbar.
echo   Do NOT close it - it keeps the POS running.
echo.
echo   To stop the server, close the "Sai Lounge POS - Server" window.
echo.

:: ============================================================
:: STEP 6 - Open browser
:: ============================================================
color 0D
echo  ----------------------------------------------------------------
echo   Opening browser to http://localhost:3001 ...
echo  ----------------------------------------------------------------
color 0F
echo.
timeout /t 2 /nobreak >nul
start "" "http://localhost:3001"

echo.
color 0A
echo   Browser launched. You can close this window.
color 0F
echo.
pause
exit /b 0
