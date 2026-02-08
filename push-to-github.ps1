# Phase 3 Step 1: Push project to GitHub
# Run this in PowerShell from the project folder (or it will cd there automatically)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Find Git (PATH may not be updated in current session after install)
$gitExe = $null
if (Get-Command git -ErrorAction SilentlyContinue) { $gitExe = "git" }
elseif (Test-Path "C:\Program Files\Git\bin\git.exe") { $env:PATH = "C:\Program Files\Git\bin;$env:PATH"; $gitExe = "git" }
elseif (Test-Path "C:\Program Files (x86)\Git\bin\git.exe") { $env:PATH = "C:\Program Files (x86)\Git\bin;$env:PATH"; $gitExe = "git" }
if (-not $gitExe) {
    Write-Host "ERROR: Git is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Install from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Tip: After installing, close and reopen the terminal, or restart Cursor." -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Checking Git status..." -ForegroundColor Cyan
$ErrorActionPreference = "SilentlyContinue"
$status = git status 2>&1
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -ne 0 -or $status -match "not a git repository") {
    Write-Host "Step 2: Initializing Git repository..." -ForegroundColor Cyan
    git init
}

Write-Host "Step 3: Verifying .env.local is ignored..." -ForegroundColor Cyan
$ErrorActionPreference = "SilentlyContinue"
$staged = git status --porcelain 2>&1 | Out-String
$ErrorActionPreference = "Stop"
if ($staged -match "\.env\.local") {
    Write-Host "WARNING: .env.local would be committed! Check .gitignore." -ForegroundColor Red
    exit 1
}
Write-Host "  .env.local is correctly ignored." -ForegroundColor Green

Write-Host "Step 4: Unstaging ignored folders (.cursor, .bolt)..." -ForegroundColor Cyan
$ErrorActionPreference = "SilentlyContinue"
git rm -r --cached .cursor 2>$null | Out-Null
git rm -r --cached .bolt 2>$null | Out-Null
$ErrorActionPreference = "Stop"

Write-Host "Step 5: Staging all files..." -ForegroundColor Cyan
git add .

Write-Host "Step 6: Configuring Git user (if needed)..." -ForegroundColor Cyan
$ErrorActionPreference = "SilentlyContinue"
$email = git config user.email 2>$null
$name = git config user.name 2>$null
$ErrorActionPreference = "Stop"
if (-not $email) { git config user.email "dev@local" }
if (-not $name) { git config user.name "Developer" }

Write-Host "Step 7: Committing..." -ForegroundColor Cyan
git commit -m "Phase 2 complete: Clerk + Supabase"

Write-Host "Step 8: Renaming branch to main (if needed)..." -ForegroundColor Cyan
git branch -M main

Write-Host ""
Write-Host "Local setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "NEXT: Create a new repo on GitHub:" -ForegroundColor Yellow
Write-Host "  1. Go to https://github.com/new"
Write-Host "  2. Enter a name (e.g. archive-intel)"
Write-Host "  3. Public, NO README, NO .gitignore, NO license"
Write-Host "  4. Click Create repository"
Write-Host ""
$repoUrl = Read-Host "Paste your GitHub repo URL (e.g. https://github.com/username/archive-intel.git)"
if ([string]::IsNullOrWhiteSpace($repoUrl)) {
    Write-Host "No URL provided. Run these manually when ready:" -ForegroundColor Yellow
    Write-Host "  git remote add origin YOUR_URL"
    Write-Host "  git push -u origin main"
    exit 0
}

$repoUrl = $repoUrl.Trim()
Write-Host "Step 9: Adding remote origin..." -ForegroundColor Cyan
git remote add origin $repoUrl

Write-Host "Step 10: Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host ""
Write-Host "Done! Your code is on GitHub." -ForegroundColor Green
