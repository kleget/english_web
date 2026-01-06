param(
  [switch]$DeleteUsers,
  [switch]$KeepUsers
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir "..")
$apiDir = Join-Path $rootDir "api"
$webDir = Join-Path $rootDir "web"
$venvActivate = Join-Path $rootDir ".venv\Scripts\Activate.ps1"
$composeFile = Join-Path $rootDir "infra\docker-compose.yml"

if (-not (Test-Path $venvActivate)) {
  Write-Host "Virtual env not found: $venvActivate"
  exit 1
}

$delete = $false
if ($DeleteUsers) {
  $delete = $true
} elseif (-not $KeepUsers) {
  $answer = Read-Host "Delete all users? (y/N)"
  if ($answer -match "^[Yy]") {
    $delete = $true
  }
}

if ($delete) {
  Write-Host "Truncating users..."
  try {
    & docker compose -f $composeFile exec -T db psql -U english -d english_web -c "TRUNCATE TABLE users CASCADE;"
  } catch {
    Write-Host "Failed to truncate users. Is docker running?"
  }
}

$apiCmd = "Set-Location `"$apiDir`"; & `"$venvActivate`"; uvicorn app.main:app --reload --env-file ..\.env"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd

$jobsCmd = "Set-Location `"$rootDir`"; & `"$venvActivate`"; python scripts\run_jobs.py --loop"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $jobsCmd

$webCmd = "Set-Location `"$webDir`"; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd

Write-Host "Started API, jobs, and web."
