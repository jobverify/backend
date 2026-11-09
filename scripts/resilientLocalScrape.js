import fs from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { finished } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

import { buildLocalScrapeRunEnv } from './localScrapeRunEnv.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const DEFAULT_MAX_RESTARTS = 8
const DEFAULT_RESTART_DELAY_MS = 60_000
const DEFAULT_SHUTDOWN_GRACE_MS = 35 * 60_000

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const parseArgs = (argv) => {
  const options = {
    runDir: null,
    parallel: true,
    dryRun: false,
    maxRestarts: DEFAULT_MAX_RESTARTS,
    restartDelayMs: DEFAULT_RESTART_DELAY_MS,
    shutdownGraceMs: DEFAULT_SHUTDOWN_GRACE_MS,
    runnerScript: 'scraper-support/runner.js',
    runnerArgs: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--run-dir') {
      options.runDir = path.resolve(argv[index + 1] || '')
      index += 1
      continue
    }
    if (arg === '--parallel') {
      options.parallel = true
      continue
    }
    if (arg === '--sequential') {
      options.parallel = false
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
    if (arg === '--max-restarts') {
      options.maxRestarts = parsePositiveInteger(argv[index + 1], DEFAULT_MAX_RESTARTS)
      index += 1
      continue
    }
    if (arg === '--restart-delay-seconds') {
      options.restartDelayMs = parsePositiveInteger(
        argv[index + 1],
        DEFAULT_RESTART_DELAY_MS / 1000,
      ) * 1000
      index += 1
      continue
    }
    if (arg === '--shutdown-grace-seconds') {
      options.shutdownGraceMs = parsePositiveInteger(
        argv[index + 1],
        DEFAULT_SHUTDOWN_GRACE_MS / 1000,
      ) * 1000
      index += 1
      continue
    }
    if (arg === '--runner-script') {
      options.runnerScript = path.resolve(argv[index + 1] || '')
      index += 1
      continue
    }
    if (arg === '--') {
      options.runnerArgs.push(...argv.slice(index + 1))
      break
    }
  }

  if (!options.runDir) {
    throw new Error('A durable run directory is required via --run-dir.')
  }
  return options
}

export const buildRunnerArgs = (options) => {
  const args = [options.runnerScript]
  if (options.parallel) args.push('--parallel')
  if (options.dryRun) args.push('--dry-run')
  args.push(...options.runnerArgs)
  return args
}

export const shouldRestartRun = ({
  stopRequested,
  restartCount,
  maxRestarts,
  checkpoint,
} = {}) => {
  if (stopRequested) return false
  if (checkpoint?.status === 'complete') return false
  if (checkpoint?.restartable === false) return false
  if (Number(checkpoint?.completedCount) >= Number(checkpoint?.totalSources)) return false
  return restartCount < maxRestarts
}

const readJsonFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
}

const writeJsonFile = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export const consumeStopRequest = (filePath) => {
  const request = readJsonFile(filePath)
  if (!request) return null
  fs.rmSync(filePath, { force: true })
  return request
}

const sleep = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

const timestamp = () => new Date().toISOString()

export const runResilientScrape = async (options, { env: sourceEnv = process.env, signal: externalSignal } = {}) => {
  fs.mkdirSync(options.runDir, { recursive: true })

  const checkpointPath = path.join(options.runDir, 'run-state.json')
  const pipelineLogPath = path.join(options.runDir, 'pipeline.log')
  const stdoutPath = path.join(options.runDir, 'stdout.log')
  const stderrPath = path.join(options.runDir, 'stderr.log')
  const metadataPath = path.join(options.runDir, 'run-metadata.json')
  const exitPath = path.join(options.runDir, 'run-exit.json')
  if (fs.existsSync(exitPath)) fs.renameSync(exitPath, path.join(options.runDir, `run-exit-${Date.now()}.json`))
  const stopRequestPath = path.join(options.runDir, 'stop-request.json')
  const runId = path.basename(options.runDir)
  let env = {
    ...buildLocalScrapeRunEnv(sourceEnv),
    SCRAPER_CHECKPOINT_FILE: checkpointPath,
    SCRAPER_RUN_ID: runId,
    SCRAPER_RUN_LEASE: options.dryRun ? '0' : '1',
  }
  const runnerArgs = buildRunnerArgs(options)
  const pipelineStream = fs.createWriteStream(pipelineLogPath, { flags: 'a' })
  const stdoutStream = fs.createWriteStream(stdoutPath, { flags: 'a' })
  const stderrStream = fs.createWriteStream(stderrPath, { flags: 'a' })
  let child = null
  let stopRequested = false
  let signalCount = 0
  let forcedShutdownTimer = null
  const startupController = new AbortController()

  const appendSupervisorLog = (message) => {
    const line = `[${timestamp()}] [supervisor] ${message}\n`
    pipelineStream.write(line)
    process.stdout.write(line)
  }

  const requestStop = (signalName) => {
    signalCount += 1
    stopRequested = true
    if (!child) startupController.abort(new Error('Classification startup stopped by user'))
    if (!child || child.exitCode !== null) return

    if (signalCount === 1) {
      appendSupervisorLog(`${signalName} received; requesting graceful runner drain.`)
      if (child.connected) child.send({ type: 'jobverify:shutdown', signal: signalName })
      else child.kill(signalName)
      forcedShutdownTimer = setTimeout(() => {
        appendSupervisorLog('Grace period expired; forcing runner termination.')
        child.kill()
      }, options.shutdownGraceMs)
      return
    }

    appendSupervisorLog(`Second ${signalName} received; forcing runner termination.`)
    child.kill()
  }

  const onSigint = () => requestStop('SIGINT')
  const onSigterm = () => requestStop('SIGTERM')
  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)
  const stopRequestTimer = setInterval(() => {
    const request = consumeStopRequest(stopRequestPath)
    if (request) requestStop(request.signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM')
  }, 2_000)
  stopRequestTimer.unref?.()

  writeJsonFile(path.join(options.runDir, 'supervisor.pid'), process.pid)
  const metadata = {
    runId,
    runDir: options.runDir,
    startedAt: timestamp(),
    workingDirectory: backendDir,
    runnerArgs,
    mode: options.dryRun ? 'dry-run' : 'live',
    parallel: options.parallel,
    maxRestarts: options.maxRestarts,
    restartDelayMs: options.restartDelayMs,
    checkpointPath,
    environment: {
      SCRAPER_CONCURRENCY: env.SCRAPER_CONCURRENCY || null,
      WORKDAY_DETAIL_FETCH_CONCURRENCY: env.WORKDAY_DETAIL_FETCH_CONCURRENCY,
      WORKDAY_REQUEST_TIMEOUT_MS: env.WORKDAY_REQUEST_TIMEOUT_MS,
      WORKDAY_SCRAPER_TIMEOUT_MS: env.WORKDAY_SCRAPER_TIMEOUT_MS,
      NODE_OPTIONS: env.NODE_OPTIONS,
      classificationStage: 'post-scrape',
    },
  }
  writeJsonFile(metadataPath, metadata)

  let restartCount = 0
  let finalExitCode = 1
  let finalSignal = null

  const onExternalAbort = () => requestStop('SIGTERM')
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

  try {
    if (externalSignal?.aborted) onExternalAbort()
    startupController.signal.throwIfAborted()
    appendSupervisorLog('Starting the scraper; classification runs in the separate post-scrape pipeline.')
    while (true) {
      const attempt = restartCount + 1
      appendSupervisorLog(`Starting runner attempt ${attempt}/${options.maxRestarts + 1}.`)
      child = spawn(process.execPath, runnerArgs, {
        cwd: backendDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        windowsHide: true,
      })
      fs.writeFileSync(path.join(options.runDir, 'runner.pid'), `${child.pid}\n`, 'ascii')

      child.stdout.on('data', (chunk) => {
        stdoutStream.write(chunk)
        pipelineStream.write(chunk)
        process.stdout.write(chunk)
      })
      child.stderr.on('data', (chunk) => {
        stderrStream.write(chunk)
        pipelineStream.write(chunk)
        process.stderr.write(chunk)
      })

      const result = await new Promise((resolve) => {
        child.once('error', (error) => resolve({ code: 1, signal: null, error }))
        child.once('exit', (code, signal) => resolve({ code, signal, error: null }))
      })
      if (forcedShutdownTimer) {
        clearTimeout(forcedShutdownTimer)
        forcedShutdownTimer = null
      }

      finalExitCode = result.code ?? (result.signal ? 1 : 0)
      finalSignal = result.signal
      appendSupervisorLog(
        `Runner attempt ${attempt} exited with code ${String(result.code)} signal ${result.signal || 'none'}.`,
      )
      if (result.error) appendSupervisorLog(`Runner launch error: ${result.error.message}`)

      const checkpoint = readJsonFile(checkpointPath)
      if (!shouldRestartRun({
        exitCode: result.code,
        signal: result.signal,
        stopRequested,
        restartCount,
        maxRestarts: options.maxRestarts,
        checkpoint,
      })) {
        break
      }

      restartCount += 1
      appendSupervisorLog(
        `Checkpoint is incomplete (${checkpoint?.completedCount || 0}/${checkpoint?.totalSources || '?'}); `
        + `restarting in ${options.restartDelayMs / 1000}s.`,
      )
      await sleep(options.restartDelayMs)
      if (!shouldRestartRun({
        stopRequested,
        restartCount,
        maxRestarts: options.maxRestarts,
        checkpoint: readJsonFile(checkpointPath),
      })) {
        break
      }
    }
  } finally {
    externalSignal?.removeEventListener('abort', onExternalAbort)
    process.off('SIGINT', onSigint)
    process.off('SIGTERM', onSigterm)
    clearInterval(stopRequestTimer)
    if (forcedShutdownTimer) clearTimeout(forcedShutdownTimer)
    const checkpoint = readJsonFile(checkpointPath)
    writeJsonFile(exitPath, {
      exitedAt: timestamp(),
      code: finalExitCode,
      signal: finalSignal,
      stopRequested,
      restartCount,
      checkpointStatus: checkpoint?.status || 'missing',
      completedCount: checkpoint?.completedCount || 0,
      totalSources: checkpoint?.totalSources || null,
    })
    await Promise.all([pipelineStream, stdoutStream, stderrStream].map(stream => {
      const closed = finished(stream, { cleanup: true })
      stream.end()
      return closed
    }))
  }

  return finalExitCode
}

const directExecutionModulePath = path.resolve(fileURLToPath(import.meta.url))
const isEntrypoint = path.resolve(process.argv[1] || '') === directExecutionModulePath

if (isEntrypoint) {
  runResilientScrape(parseArgs(process.argv.slice(2)))
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error) => {
      console.error('[supervisor] Fatal error:', error)
      process.exitCode = 1
    })
}
