import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const repoRoot = path.resolve(backendDir, '..')
const monitorScriptPath = path.join(currentDir, 'monitorLocalScrapeRun.js')

const parseArgs = (argv) => {
  const options = {
    runDir: null,
    pollMs: 20000,
    logFile: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--run-dir') {
      options.runDir = argv[index + 1] || null
      index += 1
      continue
    }

    if (arg === '--poll-ms') {
      const parsed = Number.parseInt(argv[index + 1] || '', 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        options.pollMs = parsed
      }
      index += 1
      continue
    }

    if (arg === '--log-file') {
      options.logFile = argv[index + 1] || null
      index += 1
    }
  }

  return options
}

const resolveAgainstRepoRoot = (value) => {
  if (!value) return null
  if (path.isAbsolute(value)) return value
  return path.resolve(repoRoot, value)
}

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const appendLog = (logFilePath, message) => {
  if (!logFilePath) return
  fs.appendFileSync(logFilePath, `${new Date().toISOString()} ${message}\n`, 'utf8')
}

const runMonitor = (runDir, logFilePath) => {
  try {
    execFileSync(process.execPath, [
      monitorScriptPath,
      '--json-only',
      '--run-dir',
      runDir,
    ], {
      cwd: backendDir,
      stdio: 'ignore',
      windowsHide: true,
    })
    appendLog(logFilePath, 'polled monitor state')
  } catch (error) {
    appendLog(logFilePath, `monitor poll failed: ${String(error?.message ?? error)}`)
  }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const runDir = resolveAgainstRepoRoot(options.runDir)

  if (!runDir) {
    throw new Error('A run directory is required via --run-dir.')
  }

  const exitPath = path.join(runDir, 'run-exit.json')
  const logFilePath = resolveAgainstRepoRoot(
    options.logFile || path.join(runDir, 'checkpoint-watcher.log'),
  )

  appendLog(logFilePath, `watcher started (pollMs=${options.pollMs})`)

  while (!fs.existsSync(exitPath)) {
    runMonitor(runDir, logFilePath)
    await sleep(options.pollMs)
  }

  runMonitor(runDir, logFilePath)
  appendLog(logFilePath, 'watcher stopped')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
