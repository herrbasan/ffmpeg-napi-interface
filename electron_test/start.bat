@echo off
REM Quick launcher for Electron test app

echo FFmpeg NAPI Interface - Electron Test Launcher
echo.

REM Check if built
if not exist "build\Release\ffmpeg_napi.node" (
    echo [ERROR] Native module not built yet!
    echo.
    echo Please run: npm run build
    echo.
    pause
    exit /b 1
)

REM Check if electron is installed
if not exist "electron_test\node_modules" (
    echo Installing Electron dependencies...
    cd electron_test
    call npm install
    cd ..
    echo.
)

REM Launch
echo Starting Electron test app...
cd electron_test
call npm start
