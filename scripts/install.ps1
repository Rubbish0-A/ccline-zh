#Requires -Version 5.1
<#
.SYNOPSIS
  ccline-zh bare install (Windows).
.DESCRIPTION
  Detects Node.js, then delegates to setup.js which writes ~/.claude/settings.json.
  All settings-merge logic lives in setup.js (single source of truth).
  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads .ps1 using the
  system ANSI code page, so non-ASCII here would be mojibake. User-facing
  Chinese messages are emitted by setup.js (Node UTF-8 stdout), not here.
#>
$ErrorActionPreference = 'Stop'

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host "[ccline-zh] Node.js not found. Requires Node.js >= 18: https://nodejs.org/" -ForegroundColor Red
  exit 1
}

$setup = Join-Path $PSScriptRoot 'setup.js'
if (-not (Test-Path $setup)) {
  Write-Host "[ccline-zh] setup.js not found next to this script." -ForegroundColor Red
  exit 1
}

& node $setup
exit $LASTEXITCODE
