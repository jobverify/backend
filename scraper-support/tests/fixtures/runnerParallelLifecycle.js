// Run the real worker pool in an isolated process with in-memory provider and
// persistence boundaries. No configured database, network or filesystem writes.
import { registerHooks } from 'node:module'
import { mock } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { fetchJsonWithRetry } from '../../utils/fetch.js'

const scenario = process.argv[2]
const recoveryScenario = ['transaction', 'transaction-resume', 'finalization-resume', 'finalization-still-unavailable', 'connection', 'status-read', 'status-write', 'quota', 'code-error', 'source-code-error'].includes(scenario)
const state = {
  started: [],
  httpRequests: 0,
  peerAborted: false,
  peerSettled: false,
  history: null,
  finished: null,
  error: null,
  checkpoint: null,
}
const quotaError = new Error('over your space quota. Writes are blocked on your cluster.')
const databaseError = () => Object.assign(new Error('Transaction has been aborted.'), { name: 'MongoServerError', code: 251 })
const source = (name, sourceLifecycleTimeoutMs = 0) => ({
  name,
  sourceLifecycleTimeoutMs,
  run: async () => {
    state.started.push(name)
    if (scenario === 'recovered-request-telemetry') {
      await fetchJsonWithRetry('https://offline.invalid/jobs', {
        attempts: 2, baseDelayMs: 0, label: 'fixture-listing',
        fetchImpl: async () => ({
          ok: ++state.httpRequests > 1,
          status: state.httpRequests === 1 ? 429 : 200,
          headers: { get: () => null },
          json: async () => [],
        }),
      })
    }
    if (scenario === 'source-code-error' && name === 'alpha') throw new TypeError('invalid scraper code')
    return attachInventoryEvidence([], { status: 'verified-empty', firstParty: true, listingComplete: true,
      surface: 'https://example.invalid/careers', pagesFetched: 1, reportedTotal: 0, verifiedAt: new Date().toISOString() })
  },
})
globalThis.runnerLifecycleFixture = {
  scrapers: recoveryScenario ? [source('alpha'), source('beta')]
    : scenario === 'shutdown-classification'
    ? [source('peer'), source('queued')]
    : scenario === 'classification-pending'
    ? [source('alpha'), source('beta')]
    : scenario === 'recovered-request-telemetry'
    ? [source('recovered')]
    : scenario === 'failed-retry-telemetry'
    ? [{ name: 'unavailable', run: async () => {
      state.started.push('unavailable')
      const error = new Error('fetch failed')
      if (state.started.length === 2) error.abortRetries = true
      throw error
    } }]
    : scenario === 'inactive'
    ? [source('disabled-one'), source('disabled-two')]
    : ['checkpoint-resume', 'checkpoint-failure-threshold'].includes(scenario)
      ? [source('alpha'), source('beta')]
    : ['timeout', 'uncooperative-timeout', 'checkpoint-timeout', 'cooperative-timeout', 'slow-cleanup', 'fatal-cleanup', 'persistence-cleanup'].includes(scenario)
      ? [source('broken', 5), source('queued')]
      : [source('broken', 5), source('peer'), source('queued')],
  status: name => {
    if (scenario === 'status-read' && name === 'alpha') throw databaseError()
    return { isActive: scenario !== 'inactive' }
  },
  updateStatus: name => {
    if (scenario === 'status-write' && name === 'alpha') throw databaseError()
  },
  save: async (_jobs, name, { signal, onStage }) => {
    if (name === 'alpha' && !state.recovered) {
      if (scenario.startsWith('transaction')) throw databaseError()
      if (scenario === 'quota') throw quotaError
      if (scenario === 'connection') throw Object.assign(new Error('connection lost'), { name: 'MongoNetworkError' })
      if (scenario === 'code-error') throw new TypeError('invalid persistence code')
    }
    if (scenario === 'classification-pending' && name === 'alpha') {
      const error = new Error('source persistence unfinished')
      error.classificationPending = true
      throw error
    }
    if (name === 'broken') {
      if (scenario === 'quota') throw quotaError
      if (['fatal-cleanup', 'persistence-cleanup'].includes(scenario)) {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            const error = scenario === 'fatal-cleanup'
              ? globalThis.runnerLifecycleFixture.fatalCleanupError
              : new Error('source persistence failed during abort cleanup')
            reject(error)
          }, { once: true })
        })
      }
      if (['cooperative-timeout', 'slow-cleanup'].includes(scenario)) {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            if (scenario === 'slow-cleanup') {
              setTimeout(() => reject(signal.reason), 6_000)
            } else {
              reject(signal.reason)
            }
          }, { once: true })
        })
      }
      return new Promise(() => {})
    }
    if (name === 'peer') {
      if (scenario === 'shutdown-classification') onStage({ stage: 'classification', status: 'start' })
      return new Promise((resolve, reject) => {
        signal?.addEventListener('abort', () => {
          state.peerAborted = true
          setTimeout(() => {
            state.peerSettled = true
            reject(signal.reason)
          }, 1)
        }, { once: true })
      })
    }
    return { inserted: 0 }
  },
  history: (_startedAt, summary) => {
    state.history = structuredClone(summary)
    state.settledBeforeHistory = state.peerSettled
  },
  seed: () => {
    if (scenario === 'finalization-still-unavailable' && state.recovered) throw databaseError()
  },
  finished: (details) => {
    state.finished = details
    if (scenario.startsWith('finalization-') && !state.recovered) throw databaseError()
  },
}

const stubs = new Map([
  [new URL('../../providers/index.js', import.meta.url).href,
    'export const buildScrapers = () => globalThis.runnerLifecycleFixture.scrapers'],
  [new URL('../../utils/saveToDB.js', import.meta.url).href, `
    export const saveToDB = (...args) => globalThis.runnerLifecycleFixture.save(...args)
    export const purgeExpiredJobsForQuotaRecovery = async () => ({ deletedCount: 0 })
    export const saveDryRunSnapshot = async () => { throw new Error('Unexpected dry-run write') }
  `],
  [new URL('../../utils/scraperPersistence.js', import.meta.url).href, `
    export const ensureScrapersSeeded = async () => globalThis.runnerLifecycleFixture.seed()
    export const markPipelineRunStarted = async () => {}
    export const readPreviousScraperRun = async () => null
    export const upsertScraperStatus = async name => globalThis.runnerLifecycleFixture.updateStatus(name)
    export const writeScraperRun = async (...args) => globalThis.runnerLifecycleFixture.history(...args)
    export const markPipelineRunFinished = async (...args) => globalThis.runnerLifecycleFixture.finished(...args)
  `],
  [new URL('../../../src/models/ScraperStatus.js', import.meta.url).href, `
    export default { findOne: query => ({ lean: () => ({ exec: async () => globalThis.runnerLifecycleFixture.status(query.source) }) }) }
  `],
  [new URL('../../../src/services/jobDatasetSummaryService.js', import.meta.url).href,
    'export const refreshJobDatasetSummary = async () => {}'],
])

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'dotenv') {
      return { url: 'data:text/javascript,export default { config() {} }', shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (stubs.has(url)) {
      return { format: 'module', source: stubs.get(url), shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})

// Child-only inputs avoid the developer's .env and source-selection settings.
process.env.MONGO_URI = 'mongodb://offline.invalid/never-connected'
process.env.SCRAPER_CONCURRENCY = recoveryScenario || ['timeout', 'uncooperative-timeout', 'checkpoint-timeout', 'cooperative-timeout', 'slow-cleanup', 'shutdown-classification', 'fatal-cleanup', 'persistence-cleanup'].includes(scenario) ? '1' : '2'
let checkpointDir = null
if (['checkpoint-resume', 'checkpoint-failure-threshold'].includes(scenario)) {
  checkpointDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-runner-resume-'))
  process.env.SCRAPER_CHECKPOINT_FILE = path.join(checkpointDir, 'run-state.json')
  fs.writeFileSync(process.env.SCRAPER_CHECKPOINT_FILE, JSON.stringify({
    version: 1,
    runId: 'fixture-run',
    mode: 'live',
    parallel: process.argv.includes('--parallel'),
    status: 'running',
    catalogSources: ['alpha', 'beta'],
    totalSources: 2,
    completedCount: 1,
    remainingCount: 1,
    inProgress: {},
    completed: {
      alpha: {
        completedAt: '2026-09-12T06:00:00.000Z',
        result: scenario === 'checkpoint-failure-threshold'
          ? { success: false, failureKind: 'unexpected', error: 'fixture failure' }
          : { success: true, jobs: 1 },
      },
    },
  }))
}
if (recoveryScenario || ['checkpoint-timeout', 'classification-pending', 'shutdown-classification'].includes(scenario)) {
  checkpointDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-runner-resume-'))
  process.env.SCRAPER_CHECKPOINT_FILE = path.join(checkpointDir, 'run-state.json')
}
for (const key of ['SCRAPER_ONLY', 'SCRAPER_START_AT', 'SCRAPER_START_AFTER', 'SCRAPER_SOURCE_LIFECYCLE_TIMEOUT_MS', 'SCRAPER_FAILURE_ABORT_THRESHOLD']) {
  delete process.env[key]
}
if (scenario === 'checkpoint-failure-threshold') {
  process.env.SCRAPER_FAILURE_ABORT_THRESHOLD = '1'
}
console.log = console.error = console.warn = () => {}
const { runAll, FatalScraperPersistenceError } = await import('../../runner.js')
globalThis.runnerLifecycleFixture.fatalCleanupError = new FatalScraperPersistenceError('shared persistence failed during abort cleanup')
mock.timers.enable({ apis: ['setTimeout'] })
let completed = false
const shutdownController = new AbortController()
const execute = async () => {
  state.summary = await runAll({ stopSignal: shutdownController.signal })
  if (scenario === 'transaction-resume' || scenario.startsWith('finalization-')) {
    state.firstCheckpoint = JSON.parse(fs.readFileSync(process.env.SCRAPER_CHECKPOINT_FILE, 'utf8'))
    state.recovered = true
    state.summary = await runAll({ stopSignal: shutdownController.signal })
  }
}
const run = execute().catch((error) => {
  state.error = { name: error.name, message: error.message }
}).finally(() => { completed = true })

for (let step = 0; step < 50 && !completed; step += 1) {
  await setImmediate()
  if (scenario === 'shutdown-classification' && state.started.includes('peer') && !shutdownController.signal.aborted) shutdownController.abort(new Error('fixture shutdown'))
  mock.timers.tick(1_000)
}
await setImmediate()
if (!completed) {
  process.stdout.write(JSON.stringify({ ...state, error: { name: 'UnsettledPipeline' } }))
  process.exit(0)
}
await run
mock.timers.reset()
if (checkpointDir) {
  state.checkpoint = JSON.parse(fs.readFileSync(process.env.SCRAPER_CHECKPOINT_FILE, 'utf8'))
  fs.rmSync(checkpointDir, { recursive: true, force: true })
}
process.stdout.write(JSON.stringify(state))
