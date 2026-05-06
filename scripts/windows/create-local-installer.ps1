param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [Parameter(Mandatory = $false)]
  [string]$OutputDir = "build/windows"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$artifactName = "crownforge-windows-local-installer-$Version"
$installerScript = Join-Path $repoRoot "$OutputDir/$artifactName.ps1"
$bundleZip = Join-Path $repoRoot "$OutputDir/$artifactName.zip"

$steamZip = Get-ChildItem -Path (Join-Path $repoRoot $OutputDir) -Filter "crownforge-windows-steam-$Version.zip" | Select-Object -First 1
if (-not $steamZip) {
  throw "Steam package zip not found for version $Version"
}

$scriptBody = @"
param(
  [Parameter(Mandatory = `$false)]
  [string]`$InstallPath = "`$env:ProgramFiles\\CrownforgePrototype"
)

`$ErrorActionPreference = "Stop"

`$selfDir = Split-Path -Parent `$MyInvocation.MyCommand.Path
`$payloadZip = Join-Path `$selfDir "$($steamZip.Name)"

if (-not (Test-Path `$payloadZip)) {
  throw "Missing payload zip: `$payloadZip"
}

if (Test-Path `$InstallPath) {
  Remove-Item -Recurse -Force `$InstallPath
}
New-Item -ItemType Directory -Path `$InstallPath -Force | Out-Null
Expand-Archive -Path `$payloadZip -DestinationPath `$InstallPath -Force
Write-Host "Installed Crownforge prototype to `$InstallPath"
"@

$scriptBody | Set-Content -Path $installerScript -Encoding utf8

Compress-Archive -Path $steamZip.FullName, $installerScript -DestinationPath $bundleZip -CompressionLevel Optimal -Force
Write-Host "Created local installer bundle: $bundleZip"
