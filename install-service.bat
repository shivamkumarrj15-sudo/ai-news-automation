@echo off
:: ============================================
::  Install AI News Bot as Windows Scheduled Task
::  Runs every hour automatically in background
:: ============================================

echo ============================================
echo   🤖 AI News Bot - Service Installer
echo ============================================
echo.

:: Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"
set "NODE_PATH=C:\Program Files\nodejs\node.exe"
set "TASK_NAME=AI_News_Automation_Bot"

:: Check if Node.js exists
if not exist "%NODE_PATH%" (
    echo ❌ Node.js not found at %NODE_PATH%
    echo    Trying to find node.exe...
    where node >nul 2>&1
    if errorlevel 1 (
        echo ❌ Node.js is not installed! Please install it first.
        pause
        exit /b 1
    )
    for /f "delims=" %%i in ('where node') do set "NODE_PATH=%%i"
)

echo 📂 Script Dir : %SCRIPT_DIR%
echo 🟢 Node Path  : %NODE_PATH%
echo 📋 Task Name  : %TASK_NAME%
echo.

:: Delete existing task if any
schtasks /Delete /TN "%TASK_NAME%" /F >nul 2>&1

:: Create scheduled task that runs every 1 hour
schtasks /Create ^
    /TN "%TASK_NAME%" ^
    /TR "\"%NODE_PATH%\" \"%SCRIPT_DIR%run-once.js\"" ^
    /SC HOURLY ^
    /MO 1 ^
    /ST 00:00 ^
    /RL HIGHEST ^
    /F

if errorlevel 1 (
    echo.
    echo ❌ Failed to create scheduled task!
    echo    Try running this script as Administrator.
    echo    Right-click → Run as administrator
    pause
    exit /b 1
)

echo.
echo ✅ ════════════════════════════════════════════
echo    AI News Bot installed as Windows Service!
echo ════════════════════════════════════════════════
echo.
echo    📋 Task Name : %TASK_NAME%
echo    ⏰ Schedule  : Every 1 hour
echo    📧 Emails to : shivamkumarrj225@gmail.com
echo    📝 Logs at   : %SCRIPT_DIR%bot.log
echo.
echo    Bot will run automatically even after restart!
echo    To check status: schtasks /Query /TN "%TASK_NAME%"
echo    To stop: Run uninstall-service.bat
echo ════════════════════════════════════════════════
echo.

:: Run it once now
echo 🚀 Running first job now...
"%NODE_PATH%" "%SCRIPT_DIR%run-once.js"

echo.
echo ✅ Done! Check your email.
pause
