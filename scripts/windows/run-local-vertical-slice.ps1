param(
  [Parameter(Mandatory = $false)]
  [int]$Port = 4173,
  [Parameter(Mandatory = $false)]
  [switch]$NoInstall,
  [Parameter(Mandatory = $false)]
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$qaDir = Join-Path $repoRoot "qa"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required. Install Node 20+ and re-run this script."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm is required. Install Node.js (includes npm) and re-run this script."
}

if (-not (Test-Path (Join-Path $qaDir "node_modules"))) {
  if ($NoInstall) {
    throw "qa/node_modules is missing and -NoInstall was set. Run without -NoInstall once."
  }

  Write-Host "Installing QA dependencies (first run only)..."
  Push-Location $qaDir
  try {
    npm install
  }
  finally {
    Pop-Location
  }
}

$url = "http://127.0.0.1:$Port"
$serveCommand = "npx http-server .. -a 127.0.0.1 -p $Port -c-1"

Write-Host "Starting local vertical-slice server at $url"
Write-Host "Press Ctrl+C in this window to stop."

# Delay browser launch so the local server has time to bind the port.
if (-not $NoBrowser) {
  Start-Job -ScriptBlock {
    param($launchUrl)
    Start-Sleep -Seconds 2
    Start-Process "$launchUrl/index.html"
  } -ArgumentList $url | Out-Null
}

Push-Location $qaDir
try {
  & cmd /c $serveCommand
}
finally {
  Pop-Location
}
