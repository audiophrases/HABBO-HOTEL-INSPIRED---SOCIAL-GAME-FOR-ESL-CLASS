@echo off
rem Builds Pixel Plaza and publishes it online (Cloudflare). Double-click to run.
cd /d "%~dp0"
title Pixel Plaza - deploy

where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)

if not exist node_modules (
    echo Installing dependencies...
    call npm ci || (echo. & echo Installing failed. & pause & exit /b 1)
)

echo Deploying Pixel Plaza...
call npm run deploy
if errorlevel 1 (
    echo.
    echo Deploy failed. If it asks you to log in, run: npx wrangler login
    pause
    exit /b 1
)

echo.
echo Done. Pixel Plaza is live at https://pixel-plaza.eugenime.workers.dev
pause
