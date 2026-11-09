param(
  [Parameter(Mandatory = $true)]
  [string]$LogPath,

  [string]$BackendDir = '',

  [string]$ScraperDir = '',

  [string]$BackfillScriptPath = '',

  [int]$SleepSeconds = 180
)

$ErrorActionPreference = 'Stop'

$effectiveBackendDir = $BackendDir
if ([string]::IsNullOrWhiteSpace($effectiveBackendDir)) {
  $effectiveBackendDir = Join-Path (Split-Path -Parent $PSCommandPath) '..'
}

$resolvedLogPath = (Resolve-Path $LogPath).Path
$resolvedBackendDir = (Resolve-Path $effectiveBackendDir).Path
$resolvedRunDir = Split-Path -Parent $resolvedLogPath
$resolvedScraperDir = if ([string]::IsNullOrWhiteSpace($ScraperDir)) {
  Join-Path $resolvedBackendDir 'scraper'
} else {
  (Resolve-Path $ScraperDir).Path
}
$nodePath = (Get-Command node).Source
$backfillScript = if ([string]::IsNullOrWhiteSpace($BackfillScriptPath)) {
  Join-Path $resolvedBackendDir 'scripts\backfillDryRunExperience.js'
} else {
  (Resolve-Path $BackfillScriptPath).Path
}
$progressPattern = '\[runner\] Progress: (\d+)/(\d+) scrapers finished\.'
$runExitPath = Join-Path $resolvedRunDir 'run-exit.json'
$runnerPidPath = Join-Path $resolvedRunDir 'runner.pid'

function Test-RunnerProcessAlive {
  param(
    [string]$PidPath
  )

  if (-not (Test-Path -LiteralPath $PidPath)) {
    return $false
  }

  $pidText = (Get-Content -LiteralPath $PidPath -Raw -ErrorAction SilentlyContinue).Trim()
  if ([string]::IsNullOrWhiteSpace($pidText)) {
    return $false
  }

  $runnerPid = 0
  if (-not [int]::TryParse($pidText, [ref]$runnerPid) -or $runnerPid -le 0) {
    return $false
  }

  return $null -ne (Get-Process -Id $runnerPid -ErrorAction SilentlyContinue)
}

while ($true) {
  $currentProgress = 0
  $totalProgress = 0

  if (Test-Path $resolvedLogPath) {
    $progressMatches = Select-String -Path $resolvedLogPath -Pattern $progressPattern -ErrorAction SilentlyContinue
    if ($progressMatches) {
      $lastProgress = $progressMatches | Select-Object -Last 1
      $currentProgress = [int]$lastProgress.Matches[0].Groups[1].Value
      $totalProgress = [int]$lastProgress.Matches[0].Groups[2].Value
    }
  }

  Write-Output ("[{0}] Starting dry-run experience repair pass at progress {1}/{2}" -f (Get-Date -Format o), $currentProgress, $totalProgress)
  & $nodePath --use-system-ca $backfillScript --pipeline-log=$resolvedLogPath --scraper-dir=$resolvedScraperDir --file-concurrency=1 --experience-concurrency=1 --progress-every=10
  $exitCode = $LASTEXITCODE
  Write-Output ("[{0}] Repair pass finished with exit code {1}" -f (Get-Date -Format o), $exitCode)

  $runnerExitDetected = (Test-Path -LiteralPath $runExitPath) -and -not (Test-RunnerProcessAlive -PidPath $runnerPidPath)
  if ($totalProgress -gt 0 -and $currentProgress -ge $totalProgress) {
    Write-Output ("[{0}] Dry-run experience repair monitor stopping after full runner progress {1}/{2}" -f (Get-Date -Format o), $currentProgress, $totalProgress)
    break
  }

  if ($runnerExitDetected) {
    Write-Output ("[{0}] Dry-run experience repair monitor stopping because runner exit was detected at progress {1}/{2}" -f (Get-Date -Format o), $currentProgress, $totalProgress)
    break
  }

  Start-Sleep -Seconds $SleepSeconds
}
