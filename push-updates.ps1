# Add Git to PATH (in case terminal doesn't have it)
if (Test-Path "C:\Program Files\Git\bin\git.exe") {
    $env:PATH = "C:\Program Files\Git\bin;$env:PATH"
} elseif (Test-Path "C:\Program Files (x86)\Git\bin\git.exe") {
    $env:PATH = "C:\Program Files (x86)\Git\bin;$env:PATH"
}

Set-Location $PSScriptRoot
git add package.json package-lock.json
git commit -m "Upgrade Next.js to 13.5.8 for Clerk compatibility"
git push
