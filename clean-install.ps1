# Fix EBUSY/locked file during npm install
# Run this script - if it fails, close Cursor, run again from Windows PowerShell, then reopen Cursor

Set-Location $PSScriptRoot

Write-Host "Step 1: Stop any running dev server first (Ctrl+C in that terminal)!" -ForegroundColor Yellow

Write-Host "Step 2: Removing node_modules..." -ForegroundColor Cyan
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
    if (Test-Path "node_modules") {
        Write-Host "Could not remove node_modules - close Cursor and run this script again from Windows PowerShell" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  Done." -ForegroundColor Green

Write-Host "Step 3: Removing .next (build cache)..." -ForegroundColor Cyan
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next" -ErrorAction SilentlyContinue
}
Write-Host "  Done." -ForegroundColor Green

Write-Host "Step 4: Running npm install..." -ForegroundColor Cyan
if (Test-Path "C:\Program Files\Git\bin\npm.cmd") { $env:PATH = "C:\Program Files\Git\bin;C:\Program Files\nodejs;$env:PATH" }
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Success! Dependencies installed." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "npm install failed. Try:" -ForegroundColor Red
    Write-Host "  1. Close Cursor completely"
    Write-Host "  2. Open Windows PowerShell (not in Cursor)"
    Write-Host "  3. cd to this project folder"
    Write-Host "  4. Run: .\clean-install.ps1"
    Write-Host "  5. Reopen Cursor"
}
