#Requires -Version 5.1
<#
.SYNOPSIS
  ccline-zh uninstall (Windows): delegates to uninstall.js.
  Keep ASCII-only (see install.ps1 for why).
#>
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "[ccline-zh] Node.js not found." -ForegroundColor Red
  exit 1
}

$uninstall = Join-Path $PSScriptRoot 'uninstall.js'
if (-not (Test-Path $uninstall)) {
  Write-Host "[ccline-zh] uninstall.js not found next to this script." -ForegroundColor Red
  exit 1
}

& node $uninstall
exit $LASTEXITCODE
