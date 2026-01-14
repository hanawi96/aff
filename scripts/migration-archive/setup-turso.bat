@echo off
REM Setup Turso database and configure environment
REM Run this after exporting D1 data

echo ========================================
echo Turso Database Setup Script
echo ========================================
echo.

REM Check if Turso CLI is installed
where turso >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Turso CLI not found!
    echo.
    echo Please install Turso CLI first:
    echo   npm install -g @turso/cli
    echo.
    echo Or use PowerShell:
    echo   irm get.tur.so/install.ps1 ^| iex
    echo.
    pause
    exit /b 1
)

echo Turso CLI found!
echo.

REM Login to Turso
echo Step 1: Login to Turso
echo ----------------------------------------
turso auth login
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to login to Turso
    pause
    exit /b 1
)
echo.

REM Create database
echo Step 2: Create Turso database
echo ----------------------------------------
set /p DB_NAME="Enter database name (default: vdt-production): "
if "%DB_NAME%"=="" set DB_NAME=vdt-production

turso db create %DB_NAME%
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create database
    echo Database might already exist. Continue anyway? (Y/N)
    set /p CONTINUE=
    if /i not "%CONTINUE%"=="Y" exit /b 1
)
echo.

REM Get database URL
echo Step 3: Get database URL
echo ----------------------------------------
turso db show %DB_NAME% --url > temp_url.txt
set /p TURSO_URL=<temp_url.txt
del temp_url.txt
echo Database URL: %TURSO_URL%
echo.

REM Create auth token
echo Step 4: Create auth token
echo ----------------------------------------
turso db tokens create %DB_NAME% > temp_token.txt
set /p TURSO_TOKEN=<temp_token.txt
del temp_token.txt
echo Auth token created (hidden for security)
echo.

REM Save to .env file
echo Step 5: Save configuration
echo ----------------------------------------
echo TURSO_DATABASE_URL=%TURSO_URL% > .env
echo TURSO_AUTH_TOKEN=%TURSO_TOKEN% >> .env
echo.
echo Configuration saved to .env file
echo.

REM Add token to Wrangler secrets
echo Step 6: Add token to Wrangler secrets
echo ----------------------------------------
echo %TURSO_TOKEN% | npx wrangler secret put TURSO_AUTH_TOKEN
echo.

REM Import data
echo Step 7: Import data from D1 backup
echo ----------------------------------------
echo.
echo Available backup files:
dir /b backups\d1_backup_*.sql 2>nul
echo.
set /p BACKUP_FILE="Enter backup filename (or press Enter to skip): "

if not "%BACKUP_FILE%"=="" (
    if exist "backups\%BACKUP_FILE%" (
        echo Importing data...
        turso db shell %DB_NAME% < backups\%BACKUP_FILE%
        echo Import completed!
    ) else (
        echo File not found: backups\%BACKUP_FILE%
        echo Skipping import...
    )
) else (
    echo Skipping import. You can import later with:
    echo   turso db shell %DB_NAME% ^< backups\your_backup.sql
)
echo.

REM Create replica (optional)
echo Step 8: Create replica (optional)
echo ----------------------------------------
set /p CREATE_REPLICA="Create a replica in Singapore for better performance? (Y/N): "
if /i "%CREATE_REPLICA%"=="Y" (
    turso db replicas create %DB_NAME% sin
    echo Replica created in Singapore!
)
echo.

echo ========================================
echo Setup completed successfully!
echo ========================================
echo.
echo Database URL: %TURSO_URL%
echo Configuration saved to: .env
echo.
echo Next steps:
echo 1. Update wrangler.toml with TURSO_DATABASE_URL
echo 2. Update worker.js to use Turso client
echo 3. Test locally: npm run dev
echo 4. Deploy: npx wrangler deploy
echo.

pause
