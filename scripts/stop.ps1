# Stops the local Next.js dev server started by start.ps1. Looks up
# whatever's actually listening on port 3000 rather than tracking a saved
# PID, since `npm run dev` spawns through a wrapper process on Windows and
# a saved parent PID isn't reliable to stop cleanly.

$ErrorActionPreference = 'Continue'

$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "Stopping frontend (PID $($conn.OwningProcess))..."
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Nothing listening on port 3000."
}
