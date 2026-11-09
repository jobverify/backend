param(
  [ValidateRange(1, 100)]
  [int]$Concurrency,
  [ValidateRange(1, 20)]
  [int]$WorkdayDetailFetchConcurrency = 1,
  [ValidateRange(0, 100)]
  [int]$MaxRestarts = 8,
  [ValidateRange(1, 3600)]
  [int]$RestartDelaySeconds = 60,
  [string]$RunDir = '',
  [switch]$DryRun,
  [switch]$Live,
  [switch]$NoClean,
  [switch]$Foreground
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$currentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $currentDir
$repoRoot = Split-Path -Parent $backendDir
$runLogsRoot = Join-Path $repoRoot 'artifacts\run-logs'
$mode = if ($DryRun.IsPresent) { 'dry-run' } else { 'live' }
if ($DryRun.IsPresent -and $Live.IsPresent) {
  throw 'Choose only one of -DryRun or -Live.'
}

New-Item -ItemType Directory -Force -Path $runLogsRoot | Out-Null
$activeRunPath = Join-Path $runLogsRoot "active-$mode-scrape.json"
$selectedRunDir = $null
$isResume = $false

if (-not [string]::IsNullOrWhiteSpace($RunDir)) {
  $selectedRunDir = if ([System.IO.Path]::IsPathRooted($RunDir)) {
    $RunDir
  } else {
    Join-Path $repoRoot $RunDir
  }
} elseif (Test-Path -LiteralPath $activeRunPath) {
  try {
    $activeRun = Get-Content -Raw -LiteralPath $activeRunPath | ConvertFrom-Json
    $candidateStatePath = Join-Path ([string]$activeRun.runDir) 'run-state.json'
    $candidateSupervisorPath = Join-Path ([string]$activeRun.runDir) 'supervisor.pid'
    $candidateSupervisor = $null
    if (Test-Path -LiteralPath $candidateSupervisorPath) {
      $candidateSupervisorId = 0
      if ([int]::TryParse((Get-Content -Raw -LiteralPath $candidateSupervisorPath).Trim(), [ref]$candidateSupervisorId)) {
        $candidateSupervisor = Get-Process -Id $candidateSupervisorId -ErrorAction SilentlyContinue
      }
    }
    # Installation/warmup happens before the runner creates its checkpoint.
    if ($candidateSupervisor) {
      $selectedRunDir = [string]$activeRun.runDir
      $isResume = $true
    } elseif (Test-Path -LiteralPath $candidateStatePath) {
      $candidateState = Get-Content -Raw -LiteralPath $candidateStatePath | ConvertFrom-Json
      if ($candidateState.status -ne 'complete') {
        $selectedRunDir = [string]$activeRun.runDir
        $isResume = $true
      }
    }
  } catch {
    Write-Warning "Ignoring unreadable active-run metadata: $($_.Exception.Message)"
  }
}

if (-not $selectedRunDir) {
  $runStamp = Get-Date -Format 'yyyyMMddTHHmmss'
  $selectedRunDir = Join-Path $runLogsRoot "local-scrape-$runStamp-resilient"
}
$selectedRunDir = [System.IO.Path]::GetFullPath($selectedRunDir)
New-Item -ItemType Directory -Force -Path $selectedRunDir | Out-Null
$selectedStatePath = Join-Path $selectedRunDir 'run-state.json'
if (-not $isResume -and (Test-Path -LiteralPath $selectedStatePath)) {
  $selectedState = Get-Content -Raw -LiteralPath $selectedStatePath | ConvertFrom-Json
  $isResume = $selectedState.status -ne 'complete'
}
$pipelineLogPath = Join-Path $selectedRunDir 'pipeline.log'
if (-not (Test-Path -LiteralPath $pipelineLogPath)) {
  New-Item -ItemType File -Path $pipelineLogPath | Out-Null
}

$existingSupervisorPidPath = Join-Path $selectedRunDir 'supervisor.pid'
if (Test-Path -LiteralPath $existingSupervisorPidPath) {
  $existingPidText = (Get-Content -Raw -LiteralPath $existingSupervisorPidPath).Trim()
  $existingPid = 0
  if ([int]::TryParse($existingPidText, [ref]$existingPid)) {
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Host "A resilient scraper supervisor is already running (PID $existingPid)."
      Write-Host "Run directory: $selectedRunDir"
      Write-Host "Monitor: Get-Content -Wait -LiteralPath '$selectedRunDir\pipeline.log'"
      exit 0
    }
  }
}

if (-not $isResume -and -not $NoClean.IsPresent) {
  Push-Location $backendDir
  try {
    & npm.cmd run clean:workspace
    if ($LASTEXITCODE -ne 0) {
      throw "Workspace cleanup failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

# Preserve the inherited setting so the supervisor can also fall back to .env.
if ($PSBoundParameters.ContainsKey('Concurrency')) {
  $env:SCRAPER_CONCURRENCY = [string]$Concurrency
}
$env:WORKDAY_DETAIL_FETCH_CONCURRENCY = [string]$WorkdayDetailFetchConcurrency
$env:NODE_OPTIONS = '--use-system-ca'
foreach ($name in @('SCRAPER_ONLY', 'SCRAPER_START_AT', 'SCRAPER_START_AFTER')) {
  Remove-Item -Path "Env:$name" -ErrorAction SilentlyContinue
}

$nodeArgs = [System.Collections.Generic.List[string]]::new()
$nodeArgs.Add('scripts/resilientLocalScrape.js')
$nodeArgs.Add('--run-dir')
$nodeArgs.Add($selectedRunDir)
$nodeArgs.Add('--parallel')
$nodeArgs.Add($(if ($DryRun.IsPresent) { '--dry-run' } else { '--live' }))
$nodeArgs.Add('--max-restarts')
$nodeArgs.Add([string]$MaxRestarts)
$nodeArgs.Add('--restart-delay-seconds')
$nodeArgs.Add([string]$RestartDelaySeconds)

$activeRun = @{
  runDir = $selectedRunDir
  mode = $mode
  resumed = $isResume
  launchedAt = (Get-Date).ToString('o')
}
$activeRun | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $activeRunPath -Encoding UTF8

if ($Foreground.IsPresent) {
  Push-Location $backendDir
  try {
    & node $nodeArgs.ToArray()
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

$supervisor = Start-Process `
  -FilePath 'node' `
  -ArgumentList $nodeArgs.ToArray() `
  -WorkingDirectory $backendDir `
  -WindowStyle Hidden `
  -PassThru

Set-Content -LiteralPath $existingSupervisorPidPath -Value ([string]$supervisor.Id) -Encoding ASCII

Write-Host "Resilient MongoDB scrape started."
Write-Host "Supervisor PID: $($supervisor.Id)"
Write-Host "Run directory: $selectedRunDir"
Write-Host "Pipeline log: $pipelineLogPath"
Write-Host "Checkpoint: $selectedRunDir\run-state.json"
Write-Host "Monitor: Get-Content -Wait -LiteralPath '$selectedRunDir\pipeline.log'"
