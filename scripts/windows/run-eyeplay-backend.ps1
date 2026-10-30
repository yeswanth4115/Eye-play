$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Python = (Get-Command python -ErrorAction Stop).Source
$Server = Join-Path $ProjectRoot 'backend\social_robot_gaze_server.py'
$LogDirectory = Join-Path $ProjectRoot 'logs'
$LogFile = Join-Path $LogDirectory 'eyeplay-backend.log'
New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
Set-Location $ProjectRoot
"`n[$(Get-Date -Format o)] Starting local Eye-play gaze backend with $Python" | Out-File -FilePath $LogFile -Append -Encoding utf8
& $Python -u $Server *>&1 | Tee-Object -FilePath $LogFile -Append
$exitCode = $LASTEXITCODE
"[$(Get-Date -Format o)] Backend exited with code $exitCode" | Out-File -FilePath $LogFile -Append -Encoding utf8
exit $exitCode
