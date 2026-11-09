import fs from 'node:fs'
import path from 'node:path'

const CHECKPOINT_VERSION = 1
const TRANSIENT_RENAME_ERROR_CODES = new Set(['EACCES', 'EBUSY', 'EPERM'])
const DEFAULT_RENAME_MAX_ATTEMPTS = 8
const DEFAULT_RENAME_RETRY_DELAY_MS = 25
const MAX_RENAME_RETRY_DELAY_MS = 500
const synchronousWaitBuffer = new Int32Array(new SharedArrayBuffer(4))
let temporaryFileSequence = 0

const asIsoString = (now) => now().toISOString()

const cloneJson = (value) => JSON.parse(JSON.stringify(value))

const CHECKPOINT_RESULT_FIELDS = [
  'success',
  'partial',
  'processingComplete',
  'skipped',
  'softFailure',
  'upstreamOutage',
  'localTimeout',
  'abortRetries',
  'failureKind',
  'error',
  'jobs',
  'eligibleJobs',
  'rawRecords',
  'filteredNonJob',
  'zeroJobEvidence',
  'inventoryEvidence',
  'detailHealth',
  'attemptedAt',
  'completedAt',
  'staleCheckSkipped',
  'staleCheckReason',
  'staleCheckReasonCode',
  'inserted',
  'updated',
  'deleted',
  'expired',
  'missed',
  'filteredNonIndia',
  'filteredOld',
  'filteredClosed',
  'filteredInvalidUrl',
  'filteredEmptyDescription',
  'retentionDays',
  'durationMs',
]

const compactResult = (result = {}) => {
  const compact = {}
  for (const field of CHECKPOINT_RESULT_FIELDS) {
    if (result[field] !== undefined) compact[field] = result[field]
  }
  if (result.dataQuality) compact.dataQuality = result.dataQuality
  if (result.retry) compact.retry = result.retry
  return cloneJson(compact)
}

const catalogsMatch = (left = [], right = []) => (
  left.length === right.length
  && left.every((source, index) => source === right[index])
)

const catalogsMatchWithSuccessfulRemovals = (existing, current = []) => {
  const original = existing.catalogSources || []
  if (current.length > original.length) return false
  let currentIndex = 0
  for (const source of original) {
    if (source === current[currentIndex]) {
      currentIndex += 1
    } else if (existing.completed?.[source]?.result?.success !== true) {
      return false
    }
  }
  return currentIndex === current.length
}

const waitSynchronously = (milliseconds) => {
  Atomics.wait(synchronousWaitBuffer, 0, 0, milliseconds)
}

export const renameFileWithRetry = (
  sourcePath,
  destinationPath,
  {
    rename = fs.renameSync,
    wait = waitSynchronously,
    maxAttempts = DEFAULT_RENAME_MAX_ATTEMPTS,
    retryDelayMs = DEFAULT_RENAME_RETRY_DELAY_MS,
  } = {},
) => {
  let delayMs = retryDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      rename(sourcePath, destinationPath)
      return
    } catch (error) {
      const canRetry = TRANSIENT_RENAME_ERROR_CODES.has(error?.code) && attempt < maxAttempts
      if (!canRetry) throw error
      wait(delayMs)
      delayMs = Math.min(delayMs * 2, MAX_RENAME_RETRY_DELAY_MS)
    }
  }
}

const writeJsonAtomic = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  temporaryFileSequence += 1
  const temporaryPath = `${filePath}.${process.pid}.${temporaryFileSequence}.tmp`

  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    renameFileWithRetry(temporaryPath, filePath)
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true })
    } catch {
      // Keep the original checkpoint intact when temporary-file cleanup fails.
    }
    throw error
  }
}

const loadExistingState = (filePath) => {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export const openRunCheckpoint = ({
  filePath,
  sources,
  mode,
  parallel,
  runId = path.basename(path.dirname(filePath)),
  now = () => new Date(),
} = {}) => {
  if (!filePath) return null
  if (!Array.isArray(sources) || sources.some((source) => !String(source || '').trim())) {
    throw new Error('Run checkpoint requires an ordered source catalog.')
  }

  const catalogSources = sources.map((source) => String(source).trim())
  const existing = loadExistingState(filePath)
  if (existing
    && !catalogsMatch(existing.catalogSources, catalogSources)
    && !catalogsMatchWithSuccessfulRemovals(existing, catalogSources)) {
    throw new Error(
      `Cannot resume ${filePath}: the scraper catalog changed. Start a new resilient run directory.`,
    )
  }
  if (existing && existing.mode !== mode) {
    throw new Error(`Cannot resume ${filePath}: checkpoint mode changed from ${existing.mode} to ${mode}.`)
  }
  if (existing && existing.parallel !== parallel) {
    throw new Error(`Cannot resume ${filePath}: checkpoint execution mode changed.`)
  }

  const state = existing || {
    version: CHECKPOINT_VERSION,
    runId,
    createdAt: asIsoString(now),
    mode,
    parallel,
    status: 'running',
    catalogSources,
    totalSources: catalogSources.length,
    completedCount: 0,
    remainingCount: catalogSources.length,
    restartable: true,
    inProgress: {},
    completed: {},
  }

  state.version = CHECKPOINT_VERSION
  state.status = 'running'
  state.inProgress = {}
  state.interruptedBy = null

  const persist = () => {
    state.updatedAt = asIsoString(now)
    state.completedCount = Object.keys(state.completed).length
    state.remainingCount = Math.max(0, state.totalSources - state.completedCount)
    writeJsonAtomic(filePath, state)
  }

  persist()

  return {
    filePath,
    pendingSources(candidateSources = catalogSources) {
      return candidateSources.filter((source) => !state.completed[source])
    },
    completedSummary() {
      return Object.fromEntries(
        Object.entries(state.completed).map(([source, entry]) => [source, cloneJson(entry.result)]),
      )
    },
    markSourceStarted(source) {
      state.inProgress[source] = { startedAt: asIsoString(now) }
      persist()
    },
    markSourceCompleted(source, result) {
      delete state.inProgress[source]
      state.completed[source] = {
        completedAt: asIsoString(now),
        result: compactResult(result),
      }
      persist()
    },
    heartbeat(details = {}) {
      state.heartbeat = {
        at: asIsoString(now),
        ...cloneJson(details),
      }
      persist()
    },
    finish({ interruptedBy = null, error = null, restartable = true, persistencePending = false } = {}) {
      state.interruptedBy = interruptedBy
      state.error = error ? String(error) : null
      state.restartable = restartable
      state.persistencePending = persistencePending
      state.inProgress = {}
      state.status = Object.keys(state.completed).length >= state.totalSources && !persistencePending
        ? 'complete'
        : 'interrupted'
      state.finishedAt = asIsoString(now)
      persist()
    },
    snapshot() {
      return cloneJson(state)
    },
  }
}
