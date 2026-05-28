@echo off
title AI News Telegram Bot
echo =============================================
echo   🤖 AI News Telegram Bot — Starting...
echo =============================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    echo.
)

:: Start the Telegram bot
echo 🚀 Starting Telegram Bot...
echo 💡 Press Ctrl+C to stop.
echo.
node telegram-bot.js

pause
