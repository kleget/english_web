param(
  [int]$Limit = 5
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$python = Join-Path $root ".venv\\Scripts\\python.exe"
if (-not (Test-Path $python)) {
  $python = "python"
}

$script = Join-Path $root "scripts\\run_jobs.py"
& $python $script --limit $Limit
