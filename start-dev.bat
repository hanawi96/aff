@echo off
echo ========================================
echo   VONG DAU TAM - DEVELOPMENT SERVER
echo ========================================
echo.
echo Starting Backend (Cloudflare Workers) on http://localhost:8787
echo Starting Frontend (Shop) on http://localhost:8080
echo.
echo Press Ctrl+C to stop all servers
echo ========================================
echo.

REM Start backend in new window
start "Backend API - Port 8787" cmd /k "wrangler dev --port 8787"

REM Wait 3 seconds for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
start "Frontend Shop - Port 8080" cmd /k "cd public\shop && npx http-server -p 8080 -o"

echo.
echo ========================================
echo   SERVERS STARTED!
echo ========================================
echo Backend API:  http://localhost:8787
echo Frontend:     http://localhost:8080
echo Admin Panel:  http://localhost:8080/../admin/index.html
echo ========================================
echo.
echo Press any key to exit this window...
pause >nul
