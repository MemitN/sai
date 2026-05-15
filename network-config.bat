@echo off
:: ============================================================
::   SAI LOUNGE POS - NETWORK CONFIGURATION TOOL
::   Menu-driven tool for IP info, firewall, port testing,
::   static IP setup, QR code generation, port-forwarding help.
:: ============================================================
setlocal EnableDelayedExpansion

title  Sai Lounge POS  ^|  Network Configuration
mode con: cols=80 lines=50
color 0B

:: ============================================================
:: MAIN MENU LOOP
:: ============================================================
:mainmenu
cls
color 0B
echo.
echo  ================================================================
echo    SAI LOUNGE POS  -  NETWORK CONFIGURATION TOOL
echo  ================================================================
echo.
color 0F
echo   Choose an option:
echo.
echo     1.  Show this computer's IP address
echo     2.  Reconfigure Windows Firewall (port 3001)
echo     3.  Test server status ^& port 3001
echo     4.  Set a static IP address
echo     5.  Generate QR code for staff devices
echo     6.  Port forwarding instructions (remote access)
echo     0.  Exit
echo.
color 0B
echo  ================================================================
echo.
color 0F
set /p CHOICE="   Enter option (0-6): "
echo.

if "!CHOICE!"=="1" goto :show_ip
if "!CHOICE!"=="2" goto :reconfig_fw
if "!CHOICE!"=="3" goto :test_server
if "!CHOICE!"=="4" goto :static_ip
if "!CHOICE!"=="5" goto :qr_code
if "!CHOICE!"=="6" goto :port_fwd
if "!CHOICE!"=="0" goto :bye

color 0C
echo   Invalid option. Please choose 0-6.
color 0F
timeout /t 2 /nobreak >nul
goto :mainmenu

:: ============================================================
:: OPTION 1 - Show IP address
:: ============================================================
:show_ip
cls
call :section_header "NETWORK ADDRESSES"

echo   Retrieving network information...
echo.

:: All non-loopback IPv4 addresses
color 0A
echo   IPv4 Addresses found on this computer:
color 0F
echo.

powershell -NoProfile -Command ^
    "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*'} | ForEach-Object { Write-Host ('    Interface : ' + $_.InterfaceAlias); Write-Host ('    IP Address: ' + $_.IPAddress); Write-Host ('    Prefix Len: /' + $_.PrefixLength); Write-Host '' }"

echo.
color 0A
echo   Recommended access URL for other devices:
color 0F

for /f "tokens=*" %%i in ('powershell -NoProfile -Command ^
    "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown'} | Select-Object -First 1).IPAddress" ^
    2^>nul') do set "LOCAL_IP=%%i"

if "!LOCAL_IP!"=="" set "LOCAL_IP=^<not detected^>"

color 0B
echo     http://!LOCAL_IP!:3001
echo.
color 0F
echo   Share this URL with tablets and phones on the same WiFi network.
echo.
pause
goto :mainmenu

:: ============================================================
:: OPTION 2 - Reconfigure Firewall
:: ============================================================
:reconfig_fw
cls
call :section_header "WINDOWS FIREWALL CONFIGURATION"

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    call :need_admin
    pause
    goto :mainmenu
)

echo   Removing any existing Sai Lounge POS firewall rule...
netsh advfirewall firewall delete rule name="Sai Lounge POS" >nul 2>&1

echo   Adding new inbound rule for TCP port 3001...
netsh advfirewall firewall add rule ^
    name="Sai Lounge POS" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=3001 ^
    profile=private,domain ^
    description="Sai Lounge POS - Allow LAN access on port 3001" >nul 2>&1

if %errorlevel% equ 0 (
    color 0A
    echo   [OK]  Firewall rule added: TCP 3001 inbound (Private + Domain profiles)
    color 0F
) else (
    color 0C
    echo   [ERROR]  Could not add firewall rule. Try running as Administrator.
    color 0F
)

echo.
echo   Current firewall rules for port 3001:
netsh advfirewall firewall show rule name="Sai Lounge POS" 2>nul
echo.
pause
goto :mainmenu

:: ============================================================
:: OPTION 3 - Test server + port
:: ============================================================
:test_server
cls
call :section_header "SERVER STATUS TEST"

echo   Running diagnostics...
echo.

:: 1. Node process
tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorlevel% equ 0 (
    color 0A
    echo   [PASS]  Node.js process is running.
    color 0F
) else (
    color 0C
    echo   [FAIL]  Node.js is NOT running. Start it with start.bat.
    color 0F
)

:: 2. HTTP response from localhost
powershell -NoProfile -Command ^
    "try { $r=(Invoke-WebRequest -Uri 'http://localhost:3001' -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop).StatusCode; Write-Host '  [PASS]  HTTP check localhost:3001 -> Status ' $r -ForegroundColor Green } catch { Write-Host '  [FAIL]  HTTP check localhost:3001 -> ' $_.Exception.Message -ForegroundColor Red }"

:: 3. TCP port open check
powershell -NoProfile -Command ^
    "try { $t=New-Object Net.Sockets.TcpClient; $a=$t.BeginConnect('127.0.0.1',3001,$null,$null); $ok=$a.AsyncWaitHandle.WaitOne(3000,$false); if($ok){$t.EndConnect($a);$t.Close();Write-Host '  [PASS]  TCP port 3001 is open and accepting connections.' -ForegroundColor Green} else {Write-Host '  [FAIL]  TCP port 3001 is not open.' -ForegroundColor Red} } catch { Write-Host '  [FAIL]  TCP connect failed: ' $_.Exception.Message -ForegroundColor Red }"

:: 4. Firewall rule
netsh advfirewall firewall show rule name="Sai Lounge POS" >nul 2>&1
if %errorlevel% equ 0 (
    color 0A
    echo   [PASS]  Windows Firewall rule exists for Sai Lounge POS.
    color 0F
) else (
    color 0C
    echo   [FAIL]  Windows Firewall rule NOT found. Run option 2 to fix this.
    color 0F
)

:: 5. What is listening on 3001
echo.
color 0D
echo   Processes listening on port 3001:
color 0F
netstat -ano | findstr ":3001 " | findstr "LISTENING"

echo.
pause
goto :mainmenu

:: ============================================================
:: OPTION 4 - Set static IP
:: ============================================================
:static_ip
cls
call :section_header "SET STATIC IP ADDRESS"

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    call :need_admin
    pause
    goto :mainmenu
)

color 0E
echo   WARNING: Changing network settings can disrupt connectivity.
echo   Make sure you know the correct values before proceeding.
echo.
color 0F

:: List adapters
echo   Available network adapters:
echo.
powershell -NoProfile -Command ^
    "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Select-Object -Property Name,InterfaceDescription | Format-Table -AutoSize"

echo.
set /p ADAPTER="   Enter the adapter name exactly as shown above: "
echo.

:: Verify adapter exists
netsh interface show interface name="!ADAPTER!" >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo   [ERROR]  Adapter '!ADAPTER!' not found. Check the name and try again.
    color 0F
    echo.
    pause
    goto :mainmenu
)

set /p STATIC_IP="   New static IP address  (e.g. 192.168.1.50): "
set /p SUBNET="   Subnet mask            (e.g. 255.255.255.0): "
set /p GATEWAY="   Default gateway        (e.g. 192.168.1.1): "
set /p DNS1="   Primary DNS            (e.g. 8.8.8.8 or gateway IP): "
echo.

color 0E
echo   You are about to set:
echo     Adapter : !ADAPTER!
echo     IP      : !STATIC_IP!
echo     Subnet  : !SUBNET!
echo     Gateway : !GATEWAY!
echo     DNS     : !DNS1!
echo.
color 0F
set /p CONFIRM="   Apply these settings? (Y/N): "
if /i "!CONFIRM!" neq "Y" (
    echo   Cancelled.
    pause
    goto :mainmenu
)

echo.
echo   Applying static IP...
netsh interface ip set address name="!ADAPTER!" static !STATIC_IP! !SUBNET! !GATEWAY! >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo   [ERROR]  Failed to set IP address. Run as Administrator.
    color 0F
    pause
    goto :mainmenu
)

echo   Setting DNS...
netsh interface ip set dns name="!ADAPTER!" static !DNS1! >nul 2>&1

color 0A
echo.
echo   [OK]  Static IP applied: !STATIC_IP!
echo.
echo   Sai Lounge POS will now always be at:
echo     http://!STATIC_IP!:3001
echo.
color 0F
echo   TIP: Update your router's DHCP reservation table too so the
echo   router doesn't conflict. You can also use this IP as a QR code.
echo.
pause
goto :mainmenu

:: ============================================================
:: OPTION 5 - Generate QR code
:: ============================================================
:qr_code
cls
call :section_header "QR CODE GENERATOR"

:: Detect local IP
for /f "tokens=*" %%i in ('powershell -NoProfile -Command ^
    "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown'} | Select-Object -First 1).IPAddress" ^
    2^>nul') do set "LOCAL_IP=%%i"

if "!LOCAL_IP!"=="" (
    color 0E
    echo   Could not detect local IP. Please enter it manually.
    color 0F
    set /p LOCAL_IP="   Enter IP address: "
)

set "ACCESS_URL=http://!LOCAL_IP!:3001"

echo   Generating QR code for: !ACCESS_URL!
echo.

:: Use PowerShell + .NET to create a QR code HTML page
:: The HTML uses the free QR code JS library from CDN (no internet needed for local use)
set "QR_HTML=%TEMP%\sai_lounge_qr.html"

(
echo ^<!DOCTYPE html^>
echo ^<html lang="en"^>
echo ^<head^>
echo ^<meta charset="UTF-8"^>
echo ^<meta name="viewport" content="width=device-width, initial-scale=1"^>
echo ^<title^>Sai Lounge POS - QR Code^</title^>
echo ^<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"^>^</script^>
echo ^<style^>
echo   body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a1628; color: #e0e8ff;
echo          display: flex; flex-direction: column; align-items: center;
echo          justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
echo   .card { background: #162040; border-radius: 16px; padding: 40px;
echo           box-shadow: 0 8px 32px rgba(0,120,255,0.3); text-align: center; max-width: 420px; }
echo   h1 { color: #00cfff; font-size: 1.6rem; margin-bottom: 4px; }
echo   .subtitle { color: #7a9ccc; font-size: 0.9rem; margin-bottom: 28px; }
echo   #qrcode { background: white; padding: 16px; border-radius: 12px; display: inline-block; margin-bottom: 24px; }
echo   .url { background: #0d1f3c; border: 1px solid #1e4080; border-radius: 8px;
echo          padding: 12px 20px; font-size: 1rem; color: #00cfff; word-break: break-all; }
echo   .instructions { color: #7a9ccc; font-size: 0.85rem; margin-top: 20px; line-height: 1.6; }
echo   .codes { background: #0d1f3c; border-radius: 8px; padding: 16px; margin-top: 20px; text-align: left; }
echo   .codes h3 { color: #00cfff; margin: 0 0 10px 0; font-size: 0.95rem; }
echo   .codes table { width: 100%%; border-collapse: collapse; }
echo   .codes td { padding: 4px 8px; font-size: 0.85rem; }
echo   .codes td:last-child { color: #ffd700; font-weight: bold; }
echo   .print-btn { margin-top: 20px; padding: 10px 28px; background: #0056cc; border: none;
echo               color: white; border-radius: 8px; cursor: pointer; font-size: 0.95rem; }
echo   .print-btn:hover { background: #0070ff; }
echo ^</style^>
echo ^</head^>
echo ^<body^>
echo ^<div class="card"^>
echo   ^<h1^>&#127374; Sai Lounge POS^</h1^>
echo   ^<div class="subtitle"^>Scan to open on your device^</div^>
echo   ^<div id="qrcode"^>^</div^>
echo   ^<div class="url"^>!ACCESS_URL!^</div^>
echo   ^<div class="instructions"^>
echo     Connect your device to the same WiFi network,^<br^>
echo     then scan this QR code or type the address above.
echo   ^</div^>
echo   ^<div class="codes"^>
echo     ^<h3^>Staff Login Codes^</h3^>
echo     ^<table^>
echo       ^<tr^>^<td^>Admin^</td^>^<td^>4000^</td^>^</tr^>
echo       ^<tr^>^<td^>Cashier^</td^>^<td^>2000^</td^>^</tr^>
echo       ^<tr^>^<td^>Kitchen^</td^>^<td^>3000^</td^>^</tr^>
echo       ^<tr^>^<td^>Waiters^</td^>^<td^>1001^</td^>^</tr^>
echo     ^</table^>
echo   ^</div^>
echo   ^<button class="print-btn" onclick="window.print()"^>&#128438; Print QR Code^</button^>
echo ^</div^>
echo ^<script^>
echo   new QRCode(document.getElementById('qrcode'), {
echo     text: '!ACCESS_URL!',
echo     width: 220, height: 220,
echo     colorDark: '#000000', colorLight: '#ffffff',
echo     correctLevel: QRCode.CorrectLevel.H
echo   });
echo ^</script^>
echo ^</body^>
echo ^</html^>
) > "!QR_HTML!"

if exist "!QR_HTML!" (
    color 0A
    echo   [OK]  QR code page created.
    color 0F
    echo.
    echo   Opening QR code in your browser...
    echo   Staff can scan it with any phone camera or QR scanner app.
    echo.
    echo   NOTE: Requires internet connection for first load (CDN library).
    echo         For offline use, print the QR code while online.
    echo.
    start "" "!QR_HTML!"
) else (
    color 0C
    echo   [ERROR]  Could not create QR code file.
    color 0F
)

echo.
pause
goto :mainmenu

:: ============================================================
:: OPTION 6 - Port forwarding instructions
:: ============================================================
:port_fwd
cls
call :section_header "PORT FORWARDING - REMOTE ACCESS"

for /f "tokens=*" %%i in ('powershell -NoProfile -Command ^
    "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown'} | Select-Object -First 1).IPAddress" ^
    2^>nul') do set "LOCAL_IP=%%i"

color 0E
echo   NOTE: Port forwarding lets people access Sai Lounge POS from
echo   OUTSIDE your building via the internet. Only do this if you
echo   understand the security implications.
echo.
color 0F

echo  ----------------------------------------------------------------
echo   HOW TO SET UP PORT FORWARDING
echo  ----------------------------------------------------------------
echo.
echo   1. Find your router's admin page IP address
echo      - Usually: 192.168.0.1 or 192.168.1.1
echo      - Open a browser and type it in the address bar
echo      - Log in (check the label on the back of your router)
echo.
echo   2. Look for "Port Forwarding", "Virtual Server",
echo      or "NAT" in the router settings.
echo.
echo   3. Add a new port forwarding rule:
color 0A
echo      External Port : 3001
echo      Internal IP   : !LOCAL_IP!  (this computer)
echo      Internal Port : 3001
echo      Protocol      : TCP
color 0F
echo.
echo   4. Find your public IP at:  https://whatismyip.com
echo.
echo   5. Staff outside the building can then access:
color 0A
echo      http://^<Your-Public-IP^>:3001
color 0F
echo.
echo  ----------------------------------------------------------------
echo   SECURITY RECOMMENDATIONS
echo  ----------------------------------------------------------------
echo.
echo   - Set a strong WiFi password to protect local access.
echo   - Consider a VPN (like OpenVPN or WireGuard) instead of
echo     direct port forwarding for better security.
echo   - Regularly update Node.js and npm packages.
echo   - Do not expose the server to the internet unless necessary.
echo   - Change the JWT_SECRET in backend\.env to a unique string.
echo.
pause
goto :mainmenu

:: ============================================================
:: EXIT
:: ============================================================
:bye
cls
color 0A
echo.
echo   Goodbye! Sai Lounge POS Network Configuration closed.
echo.
color 0F
timeout /t 2 /nobreak >nul
exit /b 0

:: ============================================================
:: SUBROUTINES
:: ============================================================
:section_header
color 0B
echo  ================================================================
echo    %~1
echo  ================================================================
color 0F
echo.
goto :eof

:need_admin
color 0C
echo   [ERROR]  This option requires Administrator privileges.
echo   Right-click network-config.bat and choose "Run as administrator".
color 0F
echo.
goto :eof
