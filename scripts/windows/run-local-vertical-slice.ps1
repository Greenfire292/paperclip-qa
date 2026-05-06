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
$serverScript = Join-Path $PSScriptRoot "serve-local-vertical-slice.cjs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required. Install Node 20+ and re-run this script."
}

if (-not (Test-Path $serverScript)) {
  throw "Missing local server script: $serverScript"
}

$url = "http://127.0.0.1:$Port"

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

Push-Location $repoRoot
try {
  node $serverScript 127.0.0.1 $Port
}
finally {
  Pop-Location
}
