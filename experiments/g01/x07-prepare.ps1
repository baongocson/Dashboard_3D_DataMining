$ErrorActionPreference = 'Stop'
$taskTools = Join-Path $PSScriptRoot '.runtime/x07-tools'
$taskZip = Join-Path $taskTools 'nginx-1.31.8.zip'
$taskBinary = Join-Path $taskTools 'nginx-1.31.8/nginx.exe'
New-Item -ItemType Directory -Path $taskTools -Force | Out-Null
if (-not (Test-Path -LiteralPath $taskZip)) {
    Invoke-WebRequest -Uri 'https://nginx.org/download/nginx-1.31.8.zip' -OutFile $taskZip
}
if ((Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash -ne 'FBB1501009BE34655CC238D460714CF20391B639013F4C73859813D7938783FD') {
    throw 'Nginx archive differs from the tested bytes; review provenance before using it.'
}
if (-not (Test-Path -LiteralPath $taskBinary)) {
    Expand-Archive -LiteralPath $taskZip -DestinationPath $taskTools
}
if ((Get-FileHash -LiteralPath $taskBinary -Algorithm SHA256).Hash -ne 'C321BDC2A6ECCDAAD3C702E4DA37E2F7BBFA4FFB3CABB9E70C586F5A5E95DA44') {
    throw 'Nginx binary differs from the tested bytes.'
}
& $taskBinary -V
