$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "node is not installed. Install Node.js first: https://nodejs.org"
    exit 1
}

$installDir = "$env:USERPROFILE\.F\src"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$baseUrl = "https://raw.githubusercontent.com/AbhiShake1/F/main"
foreach ($f in @("index.js", "detect.js", "frecency.js", "fetch.js", "read.js", "search.js", "setup.js")) {
    Invoke-WebRequest -Uri "$baseUrl/$f" -OutFile "$installDir\$f" -UseBasicParsing
}

$cmdContent = "@echo off`r`nnode `"%USERPROFILE%\.F\src\index.js`" %*"
[System.IO.File]::WriteAllText("$env:USERPROFILE\.F\F.cmd", $cmdContent)

$newDir = "$env:USERPROFILE\.F"
$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
if ($userPath -notlike "*$newDir*") {
    [Environment]::SetEnvironmentVariable('PATH', "$userPath;$newDir", 'User')
    Write-Host "Added $newDir to PATH. Restart your terminal."
}

Write-Host "F installed. Run: F -s"
