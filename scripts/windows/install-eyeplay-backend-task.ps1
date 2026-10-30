# Run from PowerShell in the Eye-play project root after installing backend requirements.
# Registers a per-user Task Scheduler job that starts the local gaze API at logon and restarts on failure.
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$Runner = Join-Path $ProjectRoot 'scripts\windows\run-eyeplay-backend.ps1'
$TaskName = 'EyePlayGazeBackend'

# Refuse duplicate setup if a task with this name is already running; replace its definition safely.
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false }
$action = New-ScheduledTaskAction -Execute $PowerShell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`"" -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Local-only Eye-play gaze inference API; no camera frames are sent to the network.' | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "Installed and started $TaskName. Check http://127.0.0.1:8765/api/health and logs\eyeplay-backend.log."
