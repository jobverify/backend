param(
  [switch]$DryRun,
  [switch]$Live,
  [string]$RunDir = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($DryRun.IsPresent -and $Live.IsPresent) {
  throw 'Choose only one of -DryRun or -Live.'
}

$currentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $currentDir
$repoRoot = Split-Path -Parent $backendDir
$runLogsRoot = Join-Path $repoRoot 'artifacts\run-logs'
$mode = if ($DryRun.IsPresent) { 'dry-run' } else { 'live' }

$selectedRunDir = $RunDir
if ([string]::IsNullOrWhiteSpace($selectedRunDir)) {
  $activeRunPath = Join-Path $runLogsRoot "active-$mode-scrape.json"
  if (-not (Test-Path -LiteralPath $activeRunPath)) {
    throw "No active $mode resilient scrape was found."
  }
  $activeRun = Get-Content -Raw -LiteralPath $activeRunPath | ConvertFrom-Json
  $selectedRunDir = [string]$activeRun.runDir
}

if (-not [System.IO.Path]::IsPathRooted($selectedRunDir)) {
  $selectedRunDir = Join-Path $repoRoot $selectedRunDir
}
$selectedRunDir = [System.IO.Path]::GetFullPath($selectedRunDir)
if (-not (Test-Path -LiteralPath $selectedRunDir)) {
  throw "Run directory does not exist: $selectedRunDir"
}

$stopRequestPath = Join-Path $selectedRunDir 'stop-request.json'
@{
  requestedAt = (Get-Date).ToString('o')
  signal = 'SIGTERM'
} | ConvertTo-Json | Set-Content -LiteralPath $stopRequestPath -Encoding UTF8

Write-Host 'Graceful stop requested. Active companies will finish before the runner exits.'
Write-Host "Monitor: Get-Content -Wait -LiteralPath '$selectedRunDir\pipeline.log'"
