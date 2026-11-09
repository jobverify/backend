import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(currentDir, '../..')
const runLogsRoot = path.join(repoRoot, 'artifacts', 'run-logs')

const parseArgs = (argv) => {
  const options = {
    checkpointSize: 100,
    ack: false,
    jsonOnly: false,
    resyncCurrent: false,
    runDir: null,
    stateFile: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--ack') {
      options.ack = true
      continue
    }

    if (arg === '--json-only') {
      options.jsonOnly = true
      continue
    }

    if (arg === '--resync-current') {
      options.resyncCurrent = true
      continue
    }

    if (arg === '--run-dir') {
      options.runDir = argv[index + 1] || null
      index += 1
      continue
    }

    if (arg === '--state-file') {
      options.stateFile = argv[index + 1] || null
      index += 1
      continue
    }

    if (arg === '--checkpoint-size') {
      const parsed = Number.parseInt(argv[index + 1] || '', 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        options.checkpointSize = parsed
      }
      index += 1
    }
  }

  return options
}

const findLatestRunDir = () => {
  if (!fs.existsSync(runLogsRoot)) return null

  const entries = fs.readdirSync(runLogsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('local-scrape-'))
    .map((entry) => ({
      name: entry.name,
      fullPath: path.join(runLogsRoot, entry.name),
      mtimeMs: fs.statSync(path.join(runLogsRoot, entry.name)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return entries[0]?.fullPath || null
}

const hasUtf16LeBom = (buffer) => buffer.length >= 2
  && buffer[0] === 0xFF
  && buffer[1] === 0xFE

const hasUtf8Bom = (buffer) => buffer.length >= 3
  && buffer[0] === 0xEF
  && buffer[1] === 0xBB
  && buffer[2] === 0xBF

const looksLikeUtf16Le = (buffer) => {
  if (hasUtf16LeBom(buffer)) return true
  if (buffer.length < 4) return false

  const sample = buffer.subarray(0, Math.min(buffer.length, 256))
  let nulByteCount = 0
  let oddByteCount = 0

  for (let index = 1; index < sample.length; index += 2) {
    oddByteCount += 1
    if (sample[index] === 0) nulByteCount += 1
  }

  return oddByteCount > 0 && nulByteCount / oddByteCount >= 0.4
}

const decodeTextFile = (buffer) => {
  if (buffer.length === 0) return ''

  if (hasUtf16LeBom(buffer)) {
    return buffer.subarray(2).toString('utf16le')
  }

  if (looksLikeUtf16Le(buffer)) {
    return buffer.toString('utf16le')
  }

  if (hasUtf8Bom(buffer)) {
    return buffer.subarray(3).toString('utf8')
  }

  return buffer.toString('utf8')
}

const readTextFile = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return ''
  return decodeTextFile(fs.readFileSync(filePath))
}

const readJsonFile = (filePath, fallback) => {
  if (!filePath || !fs.existsSync(filePath)) return fallback

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

const resolveAgainstRepoRoot = (value) => {
  if (!value) return null
  if (path.isAbsolute(value)) return value
  return path.resolve(repoRoot, value)
}

const normalizePendingCheckpoints = (value) => {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry) =>
      Number.isFinite(entry?.checkpointCompleted)
      && entry.checkpointCompleted > 0
      && Number.isFinite(entry?.stderrLength)
      && entry.stderrLength >= 0)
    .map((entry) => ({
      checkpointCompleted: Number.parseInt(entry.checkpointCompleted, 10),
      stderrLength: Number.parseInt(entry.stderrLength, 10),
    }))
    .sort((left, right) => left.checkpointCompleted - right.checkpointCompleted)
}

const parseProgress = (stdoutText) => {
  let completed = 0
  let total = null

  for (const match of stdoutText.matchAll(/Progress:\s+(\d+)\/(\d+)\s+scrapers finished/gi)) {
    completed = Number.parseInt(match[1], 10)
    total = Number.parseInt(match[2], 10)
  }

  return { completed, total }
}

const parseFailures = (stderrText) => [...stderrText.matchAll(/\[([^\]]+)\]\s+(FAILED:|UPSTREAM:)\s+([^\r\n]+)/g)]
  .map((match) => ({
    source: match[1],
    kind: match[2].replace(':', ''),
    message: match[3].trim(),
  }))

const summarizeFailuresBySource = (failures) => {
  const counts = new Map()

  for (const failure of failures) {
    counts.set(failure.source, (counts.get(failure.source) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([source, count]) => ({ source, count }))
}

const main = () => {
  const options = parseArgs(process.argv.slice(2))

  if (options.ack && options.resyncCurrent) {
    throw new Error('Cannot combine --ack with --resync-current.')
  }

  const runDir = options.runDir
    ? resolveAgainstRepoRoot(options.runDir)
    : findLatestRunDir()

  if (!runDir) {
    throw new Error(`No local scrape run directory found under ${runLogsRoot}`)
  }

  const stdoutPath = path.join(runDir, 'stdout.log')
  const stderrPath = path.join(runDir, 'stderr.log')
  const statePath = options.stateFile
    ? resolveAgainstRepoRoot(options.stateFile)
    : path.join(runDir, 'monitor-state.json')
  const state = readJsonFile(statePath, {
    acknowledgedCheckpointCompleted: 0,
    acknowledgedStderrLength: 0,
    pendingCheckpoints: [],
  })
  const pendingCheckpoints = normalizePendingCheckpoints(state.pendingCheckpoints)

  const stdoutText = readTextFile(stdoutPath)
  const stderrText = readTextFile(stderrPath)
  const progress = parseProgress(stdoutText)
  const currentCheckpointCompleted =
    Math.floor(progress.completed / options.checkpointSize) * options.checkpointSize
  const lastTrackedCheckpointCompleted = pendingCheckpoints.length > 0
    ? pendingCheckpoints[pendingCheckpoints.length - 1].checkpointCompleted
    : state.acknowledgedCheckpointCompleted
  const shouldPersistCurrentCheckpointSnapshot =
    currentCheckpointCompleted > 0
    && currentCheckpointCompleted === lastTrackedCheckpointCompleted + options.checkpointSize
    && !pendingCheckpoints.some((entry) => entry.checkpointCompleted === currentCheckpointCompleted)

  if (shouldPersistCurrentCheckpointSnapshot) {
    pendingCheckpoints.push({
      checkpointCompleted: currentCheckpointCompleted,
      stderrLength: stderrText.length,
    })
  }

  const nextCheckpointCompleted = state.acknowledgedCheckpointCompleted + options.checkpointSize
  const checkpointReady = currentCheckpointCompleted >= nextCheckpointCompleted
  const checkpointStderrText = stderrText.slice(state.acknowledgedStderrLength)
  const checkpointFailures = parseFailures(checkpointStderrText)
  const failureSummary = summarizeFailuresBySource(checkpointFailures)

  const status = {
    runDir,
    stdoutPath,
    stderrPath,
    statePath,
    checkpointSize: options.checkpointSize,
    completed: progress.completed,
    total: progress.total,
    acknowledgedCheckpointCompleted: state.acknowledgedCheckpointCompleted,
    currentCheckpointCompleted,
    nextCheckpointCompleted,
    checkpointReady,
    pendingCheckpoints,
    checkpointFailureCount: checkpointFailures.length,
    checkpointFailureSources: failureSummary,
  }

  const writeState = (nextState) => {
    fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2))
  }

  if (options.resyncCurrent) {
    if (currentCheckpointCompleted <= 0) {
      throw new Error('Cannot resync before the first completed checkpoint is reached.')
    }

    writeState({
      acknowledgedCheckpointCompleted: currentCheckpointCompleted,
      acknowledgedStderrLength: stderrText.length,
      pendingCheckpoints: [],
    })
  }

  const stateChanged = JSON.stringify(pendingCheckpoints) !== JSON.stringify(normalizePendingCheckpoints(state.pendingCheckpoints))
  if (stateChanged && !options.ack && !options.resyncCurrent) {
    writeState({
      acknowledgedCheckpointCompleted: state.acknowledgedCheckpointCompleted,
      acknowledgedStderrLength: state.acknowledgedStderrLength,
      pendingCheckpoints,
    })
  }

  if (options.ack) {
    const ackSnapshot = pendingCheckpoints.find(
      (entry) => entry.checkpointCompleted === nextCheckpointCompleted,
    ) || (checkpointReady && currentCheckpointCompleted === nextCheckpointCompleted
      ? {
        checkpointCompleted: nextCheckpointCompleted,
        stderrLength: stderrText.length,
      }
      : null)

    if (checkpointReady && !ackSnapshot) {
      throw new Error(
        `Cannot safely acknowledge checkpoint ${nextCheckpointCompleted}: progress has already advanced to ${currentCheckpointCompleted} without a saved checkpoint snapshot.`,
      )
    }

    writeState({
      acknowledgedCheckpointCompleted: ackSnapshot
        ? ackSnapshot.checkpointCompleted
        : state.acknowledgedCheckpointCompleted,
      acknowledgedStderrLength: ackSnapshot
        ? ackSnapshot.stderrLength
        : state.acknowledgedStderrLength,
      pendingCheckpoints: ackSnapshot
        ? pendingCheckpoints.filter((entry) => entry.checkpointCompleted > ackSnapshot.checkpointCompleted)
        : pendingCheckpoints,
    })

    if (!options.jsonOnly) {
      console.log(`\nCheckpoint state updated at ${statePath}`)
    }
  }

  const finalState = options.resyncCurrent
    ? {
      ...status,
      acknowledgedCheckpointCompleted: currentCheckpointCompleted,
      nextCheckpointCompleted: currentCheckpointCompleted + options.checkpointSize,
      checkpointReady: false,
      pendingCheckpoints: [],
      checkpointFailureCount: 0,
      checkpointFailureSources: [],
    }
    : status

  console.log(JSON.stringify(finalState, null, 2))

  if (!options.jsonOnly && !options.resyncCurrent && checkpointFailures.length > 0) {
    console.log('\nFailures since last acknowledged checkpoint:')
    for (const failure of checkpointFailures) {
      console.log(`- [${failure.source}] ${failure.kind}: ${failure.message}`)
    }
  }
}

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
