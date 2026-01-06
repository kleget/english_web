param(
  [string]$TaskName = "english_web_worker",
  [int]$Minutes = 5,
  [int]$Limit = 5
)

$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $root "scripts\\worker_once.ps1"
if (-not (Test-Path $runner)) {
  throw "worker_once.ps1 not found"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument (
  "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Limit $Limit"
)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes $Minutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType InteractiveToken -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Write-Host "Scheduled task '$TaskName' created. Interval: $Minutes min."
