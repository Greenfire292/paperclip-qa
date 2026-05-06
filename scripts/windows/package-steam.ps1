param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [Parameter(Mandatory = $false)]
  [string]$OutputDir = "build/windows"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$stageDir = Join-Path $repoRoot "build/windows/stage/steam"

if (Test-Path $stageDir) {
  Remove-Item -Recurse -Force $stageDir
}
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot $OutputDir) | Out-Null

$includePaths = @(
  "index.html",
  "src",
  "config",
  "docs",
  "prototype.js",
  "combatResolver.js",
  "ui_event_pipeline.js"
)

foreach ($path in $includePaths) {
  Copy-Item -Path (Join-Path $repoRoot $path) -Destination (Join-Path $stageDir $path) -Recurse -Force
}

$artifactName = "crownforge-windows-steam-$Version"
$zipPath = Join-Path $repoRoot "$OutputDir/$artifactName.zip"
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}
Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

$manifest = [ordered]@{
  artifactName = $artifactName
  version = $Version
  commit = $env:GITHUB_SHA
  buildRunNumber = $env:GITHUB_RUN_NUMBER
  buildRunId = $env:GITHUB_RUN_ID
  packagedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  purpose = "Steam depot upload candidate"
}

$manifest | ConvertTo-Json | Set-Content -Path (Join-Path $repoRoot "$OutputDir/$artifactName.manifest.json") -Encoding utf8
Write-Host "Created Steam package: $zipPath"
