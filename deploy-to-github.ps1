# PowerShell script to deploy Referral Form to GitHub
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Deploying Referral Form to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if git is installed
$gitCheck = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCheck) {
    Write-Host "✗ Error: Git is not installed or not in PATH" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✓ Git is installed" -ForegroundColor Green

# Set repository URL
$repoUrl = "https://github.com/hanawi96/aff.git"
$tempDir = "temp_repo"

Write-Host ""
Write-Host "Step 1: Cloning repository..." -ForegroundColor Yellow
if (Test-Path $tempDir) {
    Remove-Item -Recurse -Force $tempDir
}

git clone $repoUrl $tempDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Error: Failed to clone repository" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "✓ Repository cloned successfully" -ForegroundColor Green

Write-Host ""
Write-Host "Step 2: Cleaning old files..." -ForegroundColor Yellow
Set-Location $tempDir

# Remove all files except .git directory
Get-ChildItem -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
Write-Host "✓ Old files removed" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Copying new files..." -ForegroundColor Yellow
$filesToCopy = @(
    "index.html",
    "script.js", 
    "google-apps-script.js",
    "wrangler.toml",
    "_worker.js",
    "README.md"
)

foreach ($file in $filesToCopy) {
    $sourcePath = "..\$file"
    if (Test-Path $sourcePath) {
        Copy-Item $sourcePath . -Force
        Write-Host "✓ Copied $file" -ForegroundColor Green
    } else {
        Write-Host "⚠ Warning: $file not found" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Step 4: Adding files to git..." -ForegroundColor Yellow
git add .
git status

Write-Host ""
Write-Host "Step 5: Committing changes..." -ForegroundColor Yellow
git commit -m "Replace with new Referral Form - Me & Be Affiliate project"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Changes committed" -ForegroundColor Green
} else {
    Write-Host "⚠ No changes to commit or commit failed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 6: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully pushed to GitHub" -ForegroundColor Green
} else {
    Write-Host "✗ Error: Failed to push to GitHub" -ForegroundColor Red
    Write-Host "Please check your GitHub credentials" -ForegroundColor Red
    Set-Location ..
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Deployment completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Repository updated: $repoUrl" -ForegroundColor Cyan

Set-Location ..
Remove-Item -Recurse -Force $tempDir

Write-Host ""
Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
Write-Host "Done!" -ForegroundColor Green
Read-Host "Press Enter to exit"