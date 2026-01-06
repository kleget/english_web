param(
  [string]$TaskName = "english_web_worker"
)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task '$TaskName' removed."
