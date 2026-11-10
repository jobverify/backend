// Exercise the actual runner CLI with isolated source and persistence boundaries.
// All database and provider calls are replaced; only test artifacts are written.
import { registerHooks } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../utils/inventoryEvidence.js'
import { buildDescriptionSourceUpdate } from '../../../src/services/jobDescriptionPolicy.js'

const [scenario, directory] = process.argv.slice(2)
const state = { started: [], saved: [], history: null, finished: null, persistenceOptions: {}, statuses: {}, peerAborted: false }
const malformedDescriptionScenarios = ['malformed-description', 'all-description-fail', 'concurrent-description-error']
let releasePeer
const peerEnteredPersistence = new Promise(resolve => { releasePeer = resolve })
const inventory = (jobs, status = jobs.length ? 'complete-inventory' : 'verified-empty') => attachInventoryEvidence(jobs, {
  status, firstParty: true, listingComplete: status !== 'discovery-only',
  surface: 'https://example.invalid/careers', pagesFetched: 1,
  reportedTotal: jobs.length, verifiedAt: new Date().toISOString(),
})
globalThis.runnerWarningFixture = {
  check: (boundary, source) => {
    if (scenario === `database-${boundary}` && (!source || source === 'broken')) throw Object.assign(new Error(`database ${boundary}`), { name: 'MongoNetworkError' })
    if (scenario === boundary) throw new Error(`shared ${boundary}`)
  },
  build: () => {
    if (scenario === 'runner-code-error') throw new ReferenceError('shared provider catalog code failed')
    return (scenario === 'concurrent-description-error' ? ['broken', 'peer', 'healthy'] : ['broken', 'healthy']).map(name => ({ name, sourceLifecycleTimeoutMs: 0,
      dryRunFile: scenario === 'artifact-error' ? directory : path.join(directory, `${name}.json`), run: async () => {
      state.started.push(name)
      if (name === 'broken' && scenario === 'source-code-error') throw Object.assign(new TypeError('source parser is not a function'), { abortRetries: true })
      if (name === 'broken' && scenario === 'source-network-error') throw Object.assign(new Error('provider DNS unavailable'), { code: 'ENOTFOUND', abortRetries: true })
      if (scenario === 'all-fail' || (name === 'broken' && ['source-failure', 'fatal-source'].includes(scenario))) {
        throw Object.assign(new Error('source inventory contract failed'), {
          abortRetries: true, ...(scenario === 'fatal-source' ? { abortPipeline: true } : {}),
        })
      }
      if (name === 'broken' && scenario === 'invalid-inventory') return { jobs: [] }
      if (name === 'broken' && scenario === 'null-row') return [null]
      if (name === 'broken' && scenario === 'scalar-row') return ['not a job record']
      if (name === 'broken' && scenario === 'array-row') return [[]]
      if (malformedDescriptionScenarios.includes(scenario) && (name === 'broken' || scenario === 'all-description-fail')) {
        return inventory([{ title: 'Engineer', location: 'Bengaluru, India', country: 'India',
          sourceDescription: '<p>Maintain production equipment, diagnose faults and coordinate preventive maintenance with the plant team.</p><span',
          applyUrl: 'https://example.invalid/careers/engineer' }])
      }
      if (name === 'broken' && scenario === 'blocked-zero') return inventory([], 'discovery-only')
      if (name === 'broken' && scenario === 'unverified-zero') return []
      if (name === 'broken' && ['incomplete-details', 'missing-evidence', 'incomplete-inventory', 'stale-evidence', 'complete-inventory'].includes(scenario)) {
        const jobs = [{ title: 'Engineer', location: 'Bengaluru, India', country: 'India',
          description: scenario === 'incomplete-details' ? '' : 'Build and operate reliable applications.',
          applyUrl: 'https://example.invalid/careers/engineer' }]
        if (scenario === 'missing-evidence') return jobs
        const result = inventory(jobs, scenario === 'incomplete-inventory' ? 'discovery-only' : 'complete-inventory')
        if (scenario === 'stale-evidence') return attachInventoryEvidence(result, { ...result[Symbol.for('jobverify.inventory-evidence')],
          verifiedAt: new Date(Date.now() - 72 * 3600_000).toISOString() })
        return result
      }
      return inventory([])
    } }))
  },
  save: async (_jobs, name, options) => {
    state.persistenceOptions[name] = { replaceExisting: options.replaceExisting, authoritativeEmpty: options.authoritativeEmpty }
    if (scenario === 'concurrent-description-error' && name === 'peer') {
      await new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => { state.peerAborted = true; reject(options.signal.reason) }, { once: true })
        releasePeer()
        setTimeout(resolve, 30)
      })
    }
    if (malformedDescriptionScenarios.includes(scenario) && (name === 'broken' || scenario === 'all-description-fail')) {
      if (scenario === 'concurrent-description-error') await peerEnteredPersistence
      buildDescriptionSourceUpdate(_jobs[0], null, { mode: 'publish' })
    }
    if (scenario === 'processing-code-error' && name === 'broken') throw new TypeError('source processing is not a function')
    if (scenario === 'persistence-error') throw new TypeError('shared persistence code failed')
    if (scenario === 'quota-error') throw new Error('over your space quota. Writes are blocked on your cluster.')
    if (name === 'broken' && scenario === 'transaction-error') throw Object.assign(new Error('transaction aborted'), { name: 'MongoServerError', code: 251 })
    if (name === 'broken' && scenario === 'pending') {
      throw Object.assign(new Error('source persistence unfinished'), { classificationPending: true })
    }
    state.saved.push(name)
    return { inserted: 1, updated: 2 }
  },
  snapshot: async (jobs, file) => {
    fs.writeFileSync(file, JSON.stringify(jobs))
    state.saved.push(path.basename(file, '.json'))
  },
  history: (_startedAt, summary) => { state.history = summary },
  finished: details => {
    state.finished = details
    globalThis.runnerWarningFixture.check('finish-error')
  },
  status: name => ({ isActive: !(scenario === 'inactive' && name === 'broken') }),
}
const stubs = new Map([
  [new URL('../../providers/index.js', import.meta.url).href,
    'export const buildScrapers = () => globalThis.runnerWarningFixture.build()'],
  [new URL('../../utils/saveToDB.js', import.meta.url).href, `
    export const saveToDB = (...args) => globalThis.runnerWarningFixture.save(...args)
    export const purgeExpiredJobsForQuotaRecovery = async () => ({ deletedCount: 0 })
    export const saveDryRunSnapshot = (...args) => globalThis.runnerWarningFixture.snapshot(...args)
  `],
  [new URL('../../utils/scraperPersistence.js', import.meta.url).href, `
    export const ensureScrapersSeeded = async () => globalThis.runnerWarningFixture.check('seed-error')
    export const markPipelineRunStarted = async () => globalThis.runnerWarningFixture.check('pipeline-start-error')
    export const readPreviousScraperRun = async () => null
    export const upsertScraperStatus = async (source, result) => {
      globalThis.runnerWarningFixture.check('status-write-error', source)
      globalThis.runnerWarningFixture.recordStatus(source, result)
    }
    export const writeScraperRun = (...args) => globalThis.runnerWarningFixture.history(...args)
    export const markPipelineRunFinished = (...args) => globalThis.runnerWarningFixture.finished(...args)
  `],
  [new URL('../../../src/models/ScraperStatus.js', import.meta.url).href,
    `export default { findOne: ({ source }) => ({ lean: () => ({ exec: async () => {
      globalThis.runnerWarningFixture.check('active-status-error', source)
      return globalThis.runnerWarningFixture.status(source)
    } }) }) }`],
  [new URL('../../../src/services/jobDatasetSummaryService.js', import.meta.url).href,
    'export const refreshJobDatasetSummary = async () => {}'],
])
globalThis.runnerWarningFixture.recordStatus = (source, result) => { state.statuses[source] = structuredClone(result) }
if (scenario === 'analysis-error') {
  const actualMetrics = new URL('../../utils/publishableJobMetrics.js?runnerWarningFixture=actual', import.meta.url).href
  stubs.set(new URL('../../utils/publishableJobMetrics.js', import.meta.url).href,
    `export * from ${JSON.stringify(actualMetrics)};
     export const analyzePublishableJobs = () => { throw new ReferenceError("shared inventory analysis code failed") }`)
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'dotenv') return { url: 'data:text/javascript,export default { config() {} }', shortCircuit: true }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (stubs.has(url)) return { format: 'module', source: stubs.get(url), shortCircuit: true }
    return nextLoad(url, context)
  },
})
for (const key of Object.keys(process.env)) {
  if (/^(?:SCRAPER_|PIPELINE_)/.test(key)) delete process.env[key]
}
process.env.MONGO_URI = 'mongodb://offline.invalid/never-connected'
process.env.SCRAPER_RUN_LEASE = '0'
process.env.SCRAPER_CONCURRENCY = scenario === 'concurrent-description-error' ? '2' : '1'
process.env.SCRAPER_FAILURE_ABORT_THRESHOLD = '1'
process.env.PIPELINE_SUMMARY_FILE = path.join(directory, 'summary.json')
process.env.SCRAPER_CHECKPOINT_FILE = path.join(directory, 'run-state.json')
process.on('exit', () => fs.writeFileSync(path.join(directory, 'state.json'), JSON.stringify(state)))
const runner = new URL('../../runner.js', import.meta.url)
process.argv[1] = fileURLToPath(runner)
if (scenario === 'artifact-error') process.argv.push('--dry-run')
await import(runner.href)
