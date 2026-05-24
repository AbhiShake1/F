$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "node is not installed. Install Node.js first: https://nodejs.org"
    exit 1
}

# Download source files
$installDir = "$env:USERPROFILE\.F\src"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$baseUrl = "https://raw.githubusercontent.com/AbhiShake1/F/main"
foreach ($f in @("index.js", "detect.js", "frecency.js", "fetch.js", "read.js", "search.js", "setup.js")) {
    Invoke-WebRequest -Uri "$baseUrl/$f" -OutFile "$installDir\$f" -UseBasicParsing
}

# Write wrapper
$cmdContent = "@echo off`r`nnode `"%USERPROFILE%\.F\src\index.js`" %*"
[System.IO.File]::WriteAllText("$env:USERPROFILE\.F\F.cmd", $cmdContent)

# Add to PATH only if not already there
$newDir = "$env:USERPROFILE\.F"
$userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
$alreadyInstalled = $userPath -like "*$newDir*"
if (-not $alreadyInstalled) {
    [Environment]::SetEnvironmentVariable('PATH', "$userPath;$newDir", 'User')
    Write-Host "F installed. Run: F -s"
    Write-Host "Restart your terminal for PATH to take effect."
} else {
    Write-Host "F updated."
}
