import fs from 'node:fs'
import { once } from 'node:events'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildLocalScrapeRunEnv } from './localScrapeRunEnv.js'
import { buildScrapers } from '../scraper-support/providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '..', '..')
const backendDir = path.resolve(currentDir, '..')
const runLogsRoot = path.join(repoRoot, 'artifacts', 'run-logs')
export const DEFAULT_DRY_RUN_EXPERIENCE_MONITOR_SLEEP_SECONDS = 180
const resolveExecutionPath = (value) => {
  if (value == null || value === '') return null

  const absolutePath = path.resolve(String(value))
  try {
    return fs.realpathSync.native(absolutePath)
  } catch {
    return absolutePath
  }
}

const formatTimestamp = (value = new Date()) => {
  const pad = (segment) => String(segment).padStart(2, '0')

  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
    'T',
    pad(value.getHours()),
    pad(value.getMinutes()),
    pad(value.getSeconds()),
  ].join('')
}

export const parseArgs = (argv) => {
  const options = {
    runDir: null,
    parallel: true,
    dryRun: true,
    experienceMonitor: true,
    experienceMonitorSleepSeconds: DEFAULT_DRY_RUN_EXPERIENCE_MONITOR_SLEEP_SECONDS,
    runnerArgs: [],
    replaySourceLog: null,
    replaySourceListFile: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--run-dir') {
      options.runDir = argv[index + 1] || null
      index += 1
      continue
    }

    if (arg === '--sequential') {
      options.parallel = false
      continue
    }

    if (arg === '--parallel') {
      options.parallel = true
      continue
    }

    if (arg === '--live') {
      options.dryRun = false
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--no-experience-monitor') {
      options.experienceMonitor = false
      continue
    }

    if (arg === '--experience-monitor-sleep-seconds') {
      const parsed = Number.parseInt(argv[index + 1] || '', 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        options.experienceMonitorSleepSeconds = parsed
      }
      index += 1
      continue
    }

    if (arg === '--replay-source-log') {
      options.replaySourceLog = argv[index + 1] || null
      index += 1
      continue
    }

    if (arg === '--replay-source-list-file') {
      options.replaySourceListFile = argv[index + 1] || null
      index += 1
      continue
    }

    if (arg === '--') {
      options.runnerArgs.push(...argv.slice(index + 1))
      break
    }
  }

  return options
}

const resolveRunDir = (requestedRunDir) => {
  if (!requestedRunDir) {
    return path.join(runLogsRoot, `local-scrape-${formatTimestamp()}`)
  }

  return path.isAbsolute(requestedRunDir)
    ? requestedRunDir
    : path.resolve(repoRoot, requestedRunDir)
}

const buildRunnerArgs = (options) => {
  const replayMode = options.replaySourceLog || options.replaySourceListFile
  const args = [
    replayMode
      ? 'scripts/replayLocalScrapeFromLog.js'
      : 'scraper-support/runner.js',
  ]

  if (options.parallel) args.push('--parallel')
  if (options.dryRun) args.push('--dry-run')
  if (options.replaySourceLog) args.push('--source-log', options.replaySourceLog)
  if (options.replaySourceListFile) args.push('--source-list-file', options.replaySourceListFile)
  args.push(...options.runnerArgs)

  return args
}

const writeJsonFile = (filePath, value) => {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

const ensureDirectory = (directoryPath) => {
  fs.mkdirSync(directoryPath, { recursive: true })
}

export const resolveDryRunScraperDir = ({
  scrapers = buildScrapers(),
  fallbackDir = path.join(backendDir, 'scraper'),
} = {}) => {
  const dryRunRoots = new Set()

  for (const scraper of scrapers) {
    const dryRunFile = String(scraper?.dryRunFile || '').trim()
    if (!dryRunFile || !path.isAbsolute(dryRunFile)) continue

    dryRunRoots.add(path.dirname(path.dirname(dryRunFile)))
    if (dryRunRoots.size > 1) break
  }

  return dryRunRoots.size === 1
    ? [...dryRunRoots][0]
    : fallbackDir
}

export const buildDryRunExperienceMonitorConfig = ({
  dryRun = true,
  experienceMonitor = true,
  platform = process.platform,
  runDir,
  stdoutPath,
  backendDir: effectiveBackendDir = backendDir,
  scraperDir = resolveDryRunScraperDir({
    fallbackDir: path.join(effectiveBackendDir, 'scraper'),
  }),
  backfillScriptPath = path.join(effectiveBackendDir, 'scripts', 'backfillDryRunExperience.js'),
  sleepSeconds = DEFAULT_DRY_RUN_EXPERIENCE_MONITOR_SLEEP_SECONDS,
} = {}) => {
  if (!dryRun || !experienceMonitor || platform !== 'win32') {
    return null
  }

  const monitorScript = path.join(currentDir, 'monitorCurrentDryRunExperience.ps1')
  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', monitorScript,
      '-LogPath', stdoutPath,
      '-BackendDir', effectiveBackendDir,
      '-ScraperDir', scraperDir,
      '-BackfillScriptPath', backfillScriptPath,
      '-SleepSeconds', String(sleepSeconds),
    ],
    pidPath: path.join(runDir, 'experience-monitor.pid'),
    stdoutPath: path.join(runDir, 'experience-monitor.log'),
    stderrPath: path.join(runDir, 'experience-monitor.err.log'),
    monitorScript,
    scraperDir,
    backfillScriptPath,
    sleepSeconds,
  }
}

const waitForChildExit = async (child) => {
  if (!child || child.exitCode !== null) return
  await once(child, 'exit')
}

const finalizePipedChildLogs = async (child, stdoutStream, stderrStream) => {
  if (!child || !stdoutStream || !stderrStream) return

  child.stdout?.unpipe(stdoutStream)
  child.stderr?.unpipe(stderrStream)
  stdoutStream.end()
  stderrStream.end()

  await Promise.all([
    once(stdoutStream, 'finish'),
    once(stderrStream, 'finish'),
  ])
}

const main = () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.replaySourceLog && options.replaySourceListFile) {
    throw new Error('Choose only one of --replay-source-log or --replay-source-list-file.')
  }
  const runDir = resolveRunDir(options.runDir)
  const stdoutPath = path.join(runDir, 'stdout.log')
  const stderrPath = path.join(runDir, 'stderr.log')
  const metadataPath = path.join(runDir, 'run-metadata.json')
  const runnerArgs = buildRunnerArgs(options)

  ensureDirectory(runDir)

  const env = buildLocalScrapeRunEnv(process.env)

  const stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' })
  const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' })
  const child = spawn(process.execPath, runnerArgs, {
    cwd: backendDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout.pipe(stdoutStream)
  child.stderr.pipe(stderrStream)

  const experienceMonitorConfig = buildDryRunExperienceMonitorConfig({
    dryRun: options.dryRun,
    experienceMonitor: options.experienceMonitor,
    runDir,
    stdoutPath,
    backendDir,
    sleepSeconds: options.experienceMonitorSleepSeconds,
  })
  let experienceMonitorChild = null
  let experienceMonitorStdoutStream = null
  let experienceMonitorStderrStream = null

  if (experienceMonitorConfig) {
    experienceMonitorStdoutStream = fs.createWriteStream(experienceMonitorConfig.stdoutPath, { flags: 'a' })
    experienceMonitorStderrStream = fs.createWriteStream(experienceMonitorConfig.stderrPath, { flags: 'a' })
    experienceMonitorChild = spawn(experienceMonitorConfig.command, experienceMonitorConfig.args, {
      cwd: backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    experienceMonitorChild.stdout.pipe(experienceMonitorStdoutStream)
    experienceMonitorChild.stderr.pipe(experienceMonitorStderrStream)
    fs.writeFileSync(experienceMonitorConfig.pidPath, String(experienceMonitorChild.pid))
  }

  fs.writeFileSync(path.join(runDir, 'runner.pid'), String(child.pid))
  fs.writeFileSync(path.join(runDir, 'launcher.pid'), String(process.pid))
  writeJsonFile(metadataPath, {
    runDir,
    startedAt: new Date().toISOString(),
    workingDirectory: backendDir,
    nodeExecutable: process.execPath,
    runnerArgs,
    environment: {
      SCRAPER_CONCURRENCY: env.SCRAPER_CONCURRENCY,
      SCRAPER_FAILURE_ABORT_THRESHOLD: env.SCRAPER_FAILURE_ABORT_THRESHOLD,
      WORKDAY_SCRAPER_TIMEOUT_MS: env.WORKDAY_SCRAPER_TIMEOUT_MS,
      WORKDAY_REQUEST_TIMEOUT_MS: env.WORKDAY_REQUEST_TIMEOUT_MS,
      WORKDAY_DETAIL_FETCH_CONCURRENCY: env.WORKDAY_DETAIL_FETCH_CONCURRENCY,
      NODE_OPTIONS: env.NODE_OPTIONS,
      SCRAPER_ONLY: env.SCRAPER_ONLY || null,
      SCRAPER_START_AT: env.SCRAPER_START_AT || null,
      SCRAPER_START_AFTER: env.SCRAPER_START_AFTER || null,
    },
    replay: options.replaySourceLog
      ? { type: 'source-log', path: options.replaySourceLog }
      : (
          options.replaySourceListFile
            ? { type: 'source-list-file', path: options.replaySourceListFile }
            : null
        ),
    experienceMonitor: experienceMonitorConfig
      ? {
          enabled: true,
        command: experienceMonitorConfig.command,
        args: experienceMonitorConfig.args,
        stdoutPath: experienceMonitorConfig.stdoutPath,
        stderrPath: experienceMonitorConfig.stderrPath,
        scraperDir: experienceMonitorConfig.scraperDir,
        backfillScriptPath: experienceMonitorConfig.backfillScriptPath,
        sleepSeconds: experienceMonitorConfig.sleepSeconds,
      }
      : {
          enabled: false,
          reason: !options.dryRun
            ? 'disabled-for-live-runs'
            : (
                !options.experienceMonitor
                  ? 'disabled-by-flag'
                  : `unsupported-platform:${process.platform}`
              ),
        },
  })

  const stopChild = () => {
    if (child.exitCode !== null) return
    child.kill(process.platform === 'win32' ? undefined : 'SIGTERM')
  }

  const stopExperienceMonitor = () => {
    if (!experienceMonitorChild || experienceMonitorChild.exitCode !== null) return
    experienceMonitorChild.kill(process.platform === 'win32' ? undefined : 'SIGTERM')
  }

  process.on('SIGINT', stopChild)
  process.on('SIGTERM', stopChild)
  process.on('SIGINT', stopExperienceMonitor)
  process.on('SIGTERM', stopExperienceMonitor)

  child.on('exit', async (code, signal) => {
    writeJsonFile(path.join(runDir, 'run-exit.json'), {
      exitedAt: new Date().toISOString(),
      code,
      signal,
    })

    await finalizePipedChildLogs(child, stdoutStream, stderrStream)

    if (experienceMonitorChild) {
      await waitForChildExit(experienceMonitorChild)
      await finalizePipedChildLogs(
        experienceMonitorChild,
        experienceMonitorStdoutStream,
        experienceMonitorStderrStream,
      )
    }

    process.exit(code ?? (signal ? 1 : 0))
  })
}

const directExecutionModulePath = resolveExecutionPath(fileURLToPath(import.meta.url))
const isEntrypoint = resolveExecutionPath(process.argv[1]) === directExecutionModulePath

if (isEntrypoint) {
  main()
}
