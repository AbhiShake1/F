$ErrorActionPreference = 'Stop'

$installDir = "$env:USERPROFILE\.F"

if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
}

$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($userPath -like "*$installDir*") {
    $newPath = ($userPath -split ';' | Where-Object { $_ -ne $installDir }) -join ';'
    [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
}

Write-Host "F uninstalled"
