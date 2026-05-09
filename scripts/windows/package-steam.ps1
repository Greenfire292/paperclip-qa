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
  "ui_event_pipeline.js",
  "runtime_adapter.js"
)

foreach ($path in $includePaths) {
  Copy-Item -Path (Join-Path $repoRoot $path) -Destination (Join-Path $stageDir $path) -Recurse -Force
}

# Guardrail: fail fast if runtime adapter is missing from stage payload.
$runtimeAdapterStagePath = Join-Path $stageDir "runtime_adapter.js"
if (-not (Test-Path $runtimeAdapterStagePath)) {
  throw "Required packaging payload missing: runtime_adapter.js"
}

$artifactName = "crownforge-windows-steam-$Version"
$zipPath = Join-Path $repoRoot "$OutputDir/$artifactName.zip"
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}
Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

$zipEntries = [System.IO.Compression.ZipFile]::OpenRead($zipPath).Entries | ForEach-Object { $_.FullName }
if (-not ($zipEntries -contains "runtime_adapter.js")) {
  throw "Packaged artifact is missing runtime_adapter.js: $zipPath"
}

$listingPath = Join-Path $repoRoot "$OutputDir/$artifactName.filelist.txt"
$zipEntries | Sort-Object | Set-Content -Path $listingPath -Encoding utf8

$manifest = [ordered]@{
  artifactName = $artifactName
  version = $Version
  commit = $env:GITHUB_SHA
  buildRunNumber = $env:GITHUB_RUN_NUMBER
  buildRunId = $env:GITHUB_RUN_ID
  packagedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  payloadFileList = (Split-Path -Leaf $listingPath)
  purpose = "Steam depot upload candidate"
}

$manifest | ConvertTo-Json | Set-Content -Path (Join-Path $repoRoot "$OutputDir/$artifactName.manifest.json") -Encoding utf8
Write-Host "Created Steam package: $zipPath"
