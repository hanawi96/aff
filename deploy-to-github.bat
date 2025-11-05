@echo off
echo ========================================
echo  Deploying Referral Form to GitHub
echo ========================================

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo Error: Git is not installed or not in PATH
    pause
    exit /b 1
)

REM Set repository URL
set REPO_URL=https://github.com/hanawi96/aff.git
set TEMP_DIR=temp_repo

echo.
echo Step 1: Cloning repository...
if exist %TEMP_DIR% (
    rmdir /s /q %TEMP_DIR%
)
git clone %REPO_URL% %TEMP_DIR%
if errorlevel 1 (
    echo Error: Failed to clone repository
    pause
    exit /b 1
)

echo.
echo Step 2: Cleaning old files...
cd %TEMP_DIR%
for /f "delims=" %%i in ('dir /b /a-d') do (
    if not "%%i"==".git" (
        del "%%i" 2>nul
    )
)
for /f "delims=" %%i in ('dir /b /ad') do (
    if not "%%i"==".git" (
        rmdir /s /q "%%i" 2>nul
    )
)

echo.
echo Step 3: Copying new files...
copy "..\index.html" . >nul
copy "..\script.js" . >nul
copy "..\google-apps-script.js" . >nul
copy "..\wrangler.toml" . >nul
copy "..\_worker.js" . >nul
copy "..\README.md" . >nul

echo.
echo Step 4: Adding files to git...
git add .
git status

echo.
echo Step 5: Committing changes...
git commit -m "Replace with new Referral Form - Me & Be Affiliate project"
if errorlevel 1 (
    echo No changes to commit or commit failed
)

echo.
echo Step 6: Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo Error: Failed to push to GitHub
    echo Please check your GitHub credentials
    pause
    cd ..
    exit /b 1
)

echo.
echo ========================================
echo  Deployment completed successfully!
echo ========================================
echo Repository updated: %REPO_URL%

cd ..
rmdir /s /q %TEMP_DIR%

echo.
echo Cleaning up temporary files...
echo Done!
pause