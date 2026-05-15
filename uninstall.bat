@echo off
:: ============================================================
::   SAI LOUNGE POS - UNINSTALLER
::   Removes the application, firewall rule, shortcuts,
::   registry auto-start entry, and the installation folder.
::   MUST be run as Administrator.
:: ============================================================
setlocal EnableDelayedExpansion

title  Sai Lounge POS  ^|  Uninstaller
mode con: cols=80 lines=45
color 0C

:: ============================================================
:: STEP 0 - Admin check
:: ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  +----------------------------------------------------------+
    echo  ^|  ERROR: This uninstaller must be run as Administrator.   ^|
    echo  ^|  Right-click the file and choose "Run as administrator". ^|
    echo  +----------------------------------------------------------+
    echo.
    pause
    exit /b 1
)

:: ============================================================
:: BANNER
:: ============================================================
cls
color 0C
echo.
echo  ================================================================
echo    SAI LOUNGE POS  -  UNINSTALLER
echo  ================================================================
echo.
color 0E
echo   This will permanently remove Sai Lounge POS from this computer.
echo.
color 0F
echo   The following will be deleted:
echo     - Installation folder: C:\Program Files\Sai Lounge POS
echo     - Windows Firewall rule for port 3001
echo     - Desktop and Start Menu shortcuts
echo     - Auto-start registry entry (if it exists)
echo.
color 0C
echo   Your data (the SQLite database) is inside the install folder
echo   and will also be deleted. Back it up first if needed.
echo.
color 0F

:: ============================================================
:: CONFIRMATION - ask twice for safety
:: ============================================================
set /p CONFIRM1="   Are you sure you want to uninstall Sai Lounge POS? (YES/NO): "
if /i "!CONFIRM1!" neq "YES" (
    echo.
    color 0A
    echo   Uninstall cancelled. No changes were made.
    color 0F
    echo.
    pause
    exit /b 0
)

echo.
set /p CONFIRM2="   Last chance - type CONFIRM to proceed: "
if /i "!CONFIRM2!" neq "CONFIRM" (
    echo.
    color 0A
    echo   Uninstall cancelled. No changes were made.
    color 0F
    echo.
    pause
    exit /b 0
)

echo.
color 0D
echo  ================================================================
echo   Starting uninstall...
echo  ================================================================
echo.
color 0F

:: ============================================================
:: STEP 1 - Stop running Node.js processes
:: ============================================================
call :step "STEP 1" "Stopping Node.js processes"

tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo   Node.js is running. Stopping it now...
    taskkill /F /IM node.exe >nul 2>&1
    timeout /t 3 /nobreak >nul

    tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
    if %errorlevel% equ 0 (
        call :warn "Some Node.js processes could not be stopped."
        echo   You may need to close them manually before the folder can be deleted.
    ) else (
        call :ok "Node.js processes stopped."
    )
) else (
    call :ok "No Node.js processes were running."
)
echo.

:: ============================================================
:: STEP 2 - Remove Windows Firewall rule
:: ============================================================
call :step "STEP 2" "Removing Windows Firewall rule"

netsh advfirewall firewall show rule name="Sai Lounge POS" >nul 2>&1
if %errorlevel% equ 0 (
    netsh advfirewall firewall delete rule name="Sai Lounge POS" >nul 2>&1
    if %errorlevel% equ 0 (
        call :ok "Firewall rule 'Sai Lounge POS' removed."
    ) else (
        call :warn "Could not remove firewall rule. Remove it manually:"
        echo         Control Panel -> Windows Firewall -> Advanced Settings -> Inbound Rules
    )
) else (
    call :ok "No firewall rule found (already removed or never added)."
)
echo.

:: ============================================================
:: STEP 3 - Remove auto-start registry entry
:: ============================================================
call :step "STEP 3" "Removing auto-start registry entry"

reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "SaiLoungePOS" >nul 2>&1
if %errorlevel% equ 0 (
    reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "SaiLoungePOS" /f >nul 2>&1
    if %errorlevel% equ 0 (
        call :ok "Auto-start registry entry removed."
    ) else (
        call :warn "Could not remove registry entry. Remove manually:"
        echo         Run 'regedit' and navigate to:
        echo         HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run
        echo         Delete the 'SaiLoungePOS' value.
    )
) else (
    call :ok "No auto-start registry entry found."
)
echo.

:: ============================================================
:: STEP 4 - Remove Desktop shortcut
:: ============================================================
call :step "STEP 4" "Removing shortcuts"

set "DESKTOP=%PUBLIC%\Desktop"
set "STARTMENU=%ProgramData%\Microsoft\Windows\Start Menu\Programs\Sai Lounge POS"

if exist "!DESKTOP!\Sai Lounge POS.lnk" (
    del /F "!DESKTOP!\Sai Lounge POS.lnk" >nul 2>&1
    call :ok "Desktop shortcut removed."
) else (
    echo   Desktop shortcut not found (skipping).
)

:: Also check current user desktop
if exist "%USERPROFILE%\Desktop\Sai Lounge POS.lnk" (
    del /F "%USERPROFILE%\Desktop\Sai Lounge POS.lnk" >nul 2>&1
    call :ok "User desktop shortcut removed."
)

if exist "!STARTMENU!" (
    rd /S /Q "!STARTMENU!" >nul 2>&1
    if %errorlevel% equ 0 (
        call :ok "Start Menu folder removed."
    ) else (
        call :warn "Could not fully remove Start Menu folder."
    )
) else (
    echo   Start Menu folder not found (skipping).
)
echo.

:: ============================================================
:: STEP 5 - Delete the installation folder
:: ============================================================
call :step "STEP 5" "Deleting installation folder"

set "INSTALL_DIR=C:\Program Files\Sai Lounge POS"

if not exist "!INSTALL_DIR!" (
    call :ok "Installation folder not found (already removed)."
) else (
    echo   Deleting: !INSTALL_DIR!
    echo.

    :: First attempt: rd /S /Q
    rd /S /Q "!INSTALL_DIR!" >nul 2>&1

    if exist "!INSTALL_DIR!" (
        :: Second attempt: robocopy trick - mirror an empty folder to wipe it
        set "EMPTY_DIR=%TEMP%\empty_dir_sai_lounge"
        mkdir "!EMPTY_DIR!" >nul 2>&1
        robocopy "!EMPTY_DIR!" "!INSTALL_DIR!" /MIR /NFL /NDL /NJH /NJS /NC /NS /NP >nul 2>&1
        rd /S /Q "!EMPTY_DIR!" >nul 2>&1
        rd /S /Q "!INSTALL_DIR!" >nul 2>&1
    )

    if exist "!INSTALL_DIR!" (
        call :warn "Some files in the installation folder could not be deleted."
        echo.
        echo   This can happen if:
        echo     - A file is still open (try closing all browser windows)
        echo     - The Node.js server is still running
        echo.
        echo   Remaining files:
        dir /B "!INSTALL_DIR!" 2>nul
        echo.
        echo   You can delete the folder manually after rebooting:
        echo     !INSTALL_DIR!
    ) else (
        call :ok "Installation folder deleted."
    )
)
echo.

:: ============================================================
:: DONE
:: ============================================================
color 0A
echo  ================================================================
echo    UNINSTALL COMPLETE
echo  ================================================================
echo.
color 0F
echo   Sai Lounge POS has been removed from this computer.
echo.
echo   What was removed:
echo     - Application files from Program Files
echo     - Windows Firewall rule for port 3001
echo     - Desktop and Start Menu shortcuts
echo     - Auto-start registry entry
echo.
color 0E
echo   If any files could not be deleted, restart the computer
echo   and delete the folder manually:
echo     C:\Program Files\Sai Lounge POS
echo.
color 0F
pause
exit /b 0

:: ============================================================
:: SUBROUTINES
:: ============================================================
:step
color 0D
echo  ----------------------------------------------------------------
echo   [%~1]  %~2
echo  ----------------------------------------------------------------
color 0F
goto :eof

:ok
color 0A
echo   [OK]  %~1
color 0F
goto :eof

:warn
color 0E
echo   [WARN]  %~1
color 0F
goto :eof
