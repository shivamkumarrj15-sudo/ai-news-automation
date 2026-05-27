@echo off
:: ============================================
::  Uninstall AI News Bot Scheduled Task
:: ============================================

echo ============================================
echo   🤖 AI News Bot - Service Uninstaller
echo ============================================
echo.

set "TASK_NAME=AI_News_Automation_Bot"

schtasks /Delete /TN "%TASK_NAME%" /F

if errorlevel 1 (
    echo ❌ Task not found or failed to delete.
    echo    Try running as Administrator.
) else (
    echo.
    echo ✅ AI News Bot service has been removed!
    echo    No more hourly emails will be sent.
)

echo.
pause
