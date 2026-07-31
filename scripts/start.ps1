# Starts the Next.js dev server in the background. Safe to re-run - skips
# if something's already listening on port 3000.
#
# Requires portfolio-manager-backend running too (see its own scripts/
# start.ps1) - this only starts the frontend half.

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $repoRoot '.dev-server.log'

if (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue) {
    Write-Host "Something is already listening on port 3000 - leaving it alone. Run stop.ps1 first to restart."
    exit 0
}

if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
    throw "No node_modules found - run 'npm install' first (see DEVELOPMENT.md)."
}

Write-Host "Starting Next.js dev server on http://localhost:3000 (background, logging to $logFile)..."
Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', 'npm run dev' `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError "$logFile.err" `
    -WindowStyle Hidden

$up = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    try {
        Invoke-WebRequest http://localhost:3000 -TimeoutSec 3 -UseBasicParsing | Out-Null
        $up = $true
        break
    } catch {}
}
if ($up) {
    Write-Host "Frontend is up: http://localhost:3000"
} else {
    Write-Warning "Frontend didn't respond within 20s - check $logFile / $logFile.err."
}
