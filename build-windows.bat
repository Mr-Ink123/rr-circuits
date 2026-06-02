@echo off
title RR Circuits - Build for Windows
echo.
echo  =====================================
echo   RR Circuits - Build Windows EXE
echo  =====================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed.
    echo  Download it from: https://nodejs.org
    pause
    exit /b 1
)

echo  [1/3] Node.js found:
node --version

:: Install dependencies
echo.
echo  [2/3] Installing dependencies...
call npm install
if errorlevel 1 (
    echo  ERROR: npm install failed.
    pause
    exit /b 1
)

:: Build
echo.
echo  [3/3] Building Windows EXE...
echo  This may take a few minutes...
echo.
call npm run build:win
if errorlevel 1 (
    echo  ERROR: Build failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo  =====================================
echo   BUILD COMPLETE!
echo  =====================================
echo.
echo  Your files are in the  dist\  folder:
echo.
dir /b dist\*.exe 2>nul
echo.
echo  - Setup EXE  = full installer with Start Menu shortcut
echo  - Portable   = single file, no install needed
echo.
pause
