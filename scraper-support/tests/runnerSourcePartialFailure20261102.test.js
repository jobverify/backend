import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const childMarker = process.argv.indexOf('--source-partial-child')

// Run the actual runner and real persistence projection in isolated children.
// Only native/provider, persistence transport, raw-capture, proxy and env-file
// boundaries are replaced. No configured MongoDB, native HTTP or file writes.
async function runChild(mode, variant) {
  const url = relative => new URL(relative, import.meta.url).href
  const state = { sourceCalls: 0, statusReads: 0, statusWrites: [], histories: [], saveCalls: 0, rawFailures: 0 }
  const partialValues = { true: true, false: false, string: 'true', number: 1, hard: true }
  const sourceError = Object.assign(new Error('Bounded source failure'), {
    abortRetries: true,
    ...(variant === 'hard' ? {} : { softFailure: true, failureKind: 'native_role_unavailable' }),
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
    ...(Object.hasOwn(partialValues, variant) ? { partial: partialValues[variant] } : {}),
  })
  const scraper = { name: 'source-partial-fixture', retryAttempts: 1, run: async () => { state.sourceCalls++; throw sourceError } }
  globalThis.sourcePartialFixture = { state, scraper }
  const stubs = new Map([
    [url('../providers/index.js'), 'export const buildScrapers = () => [globalThis.sourcePartialFixture.scraper]; export const getScraperCatalog = () => []'],
    [url('../utils/saveToDB.js'), `
      export const saveToDB = async () => { globalThis.sourcePartialFixture.state.saveCalls++; throw new Error('Unexpected job persistence') }
      export const purgeExpiredJobsForQuotaRecovery = async () => { throw new Error('Unexpected purge') }
      export const saveDryRunSnapshot = async () => { throw new Error('Unexpected file write') }
    `],
    [url('../utils/rawCapture.js'), `
      export const saveRawSourceCapture = async () => { throw new Error('Unexpected successful capture') }
      export const saveRawSourceFailure = async () => { globalThis.sourcePartialFixture.state.rawFailures++ }
    `],
    [url('../../src/services/jobDatasetSummaryService.js'), 'export const refreshJobDatasetSummary = async () => {}'],
    [url('../utils/proxyEnvironment.js'), 'export const initializeScraperProxyEnvironment = () => {}'],
  ])
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'dotenv') return { url: 'data:text/javascript,export default { config() {} }', shortCircuit: true }
      return next(specifier, context)
    },
    load(moduleUrl, context, next) {
      if (stubs.has(moduleUrl)) return { format: 'module', source: stubs.get(moduleUrl), shortCircuit: true }
      return next(moduleUrl, context)
    },
  })

  const { default: mongoose } = await import('mongoose')
  const { default: ScraperStatus } = await import('../../src/models/ScraperStatus.js')
  const { default: ScraperRun } = await import('../../src/models/ScraperRun.js')
  const { isCompleteScraperAttempt } = await import('../utils/inventoryEvidence.js')
  const { inventoryCleanupOptions } = await import('../utils/scraperOutcome.js')
  const { runAll, runScraper } = await import('../runner.js')
  const originalReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  const originals = { findOne: ScraperStatus.findOne, update: ScraperStatus.findOneAndUpdate, previous: ScraperRun.findOne, create: ScraperRun.create }
  ScraperStatus.findOne = () => { state.statusReads++; return { lean: () => ({ exec: async () => ({ isActive: true }) }) } }
  ScraperStatus.findOneAndUpdate = async (filter, update) => {
    if (filter.source === scraper.name) state.statusWrites.push(structuredClone(update))
    return {}
  }
  ScraperRun.findOne = () => ({ sort: () => ({ lean: () => ({ exec: async () => null }) }) })
  ScraperRun.create = async value => {
    const document = new ScraperRun(value)
    assert.equal(document.validateSync(), undefined)
    state.histories.push(document.toObject({ flattenMaps: true }))
    return document
  }
  process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/never-connected-unit-contract'
  process.env.SCRAPER_CONCURRENCY = '1'
  for (const key of ['SCRAPER_ONLY', 'SCRAPER_START_AT', 'SCRAPER_START_AFTER', 'SCRAPER_FIRST_N', 'SCRAPER_CHECKPOINT_FILE', 'SCRAPER_PROXY_URL', 'SCRAPER_RUN_LEASE']) delete process.env[key]
  console.log = console.warn = console.error = () => {}
  let result
  try {
    if (mode === 'single') {
      result = await runScraper(scraper)
      const { writeScraperRun } = await import('../utils/scraperPersistence.js')
      await writeScraperRun(new Date(), { [scraper.name]: result })
    } else {
      result = (await runAll({ preparedRun: { scrapers: [scraper], checkpoint: null, summary: {}, resumeMessage: null } }))[scraper.name]
    }
    const latest = state.statusWrites.at(-1)?.$set?.latestAttempt
    const history = state.histories.at(-1)?.sources?.[scraper.name]
    assert.ok(latest && history, 'Actual status and history projections must execute')
    return { mode, variant, result, latest, history, sourceCalls: state.sourceCalls, statusReads: state.statusReads, statusWrites: state.statusWrites.length,
      saveCalls: state.saveCalls, rawFailures: state.rawFailures, sourceErrorPartial: sourceError.partial ?? null,
      resultHasPartial: Object.hasOwn(result, 'partial'), sourceErrorHasPartial: Object.hasOwn(sourceError, 'partial'),
      complete: isCompleteScraperAttempt(result), cleanup: inventoryCleanupOptions(result),
      advancedCompleteCounts: state.statusWrites.some(update => ['lastCompleteCheckAt', 'lastCompleteJobsFound', 'lastCompleteEligibleJobsFound', 'lastJobsFound'].some(key => Object.hasOwn(update.$set, key))),
      nativeHTTP: 0, DB: 0 }
  } finally {
    ScraperStatus.findOne = originals.findOne; ScraperStatus.findOneAndUpdate = originals.update
    ScraperRun.findOne = originals.previous; ScraperRun.create = originals.create
    if (originalReadyState) Object.defineProperty(mongoose.connection, 'readyState', originalReadyState)
    else delete mongoose.connection.readyState
  }
}

if (childMarker >= 0) {
  process.stdout.write(JSON.stringify(await runChild(process.argv[childMarker + 1], process.argv[childMarker + 2])))
} else {
  const self = import.meta.url
  for (const mode of ['single', 'sequential', 'parallel']) {
    for (const variant of ['true', 'false', 'missing', 'string', 'number', 'hard']) {
      test(`${mode}: failed source ${variant} partial flag retains only literal true through real status and history projection`, () => {
        const child = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(self)})`, '--', '--source-partial-child', mode, variant, ...(mode === 'parallel' ? ['--parallel'] : [])], {
          cwd: fileURLToPath(new URL('../../', self)), encoding: 'utf8', timeout: 15000, windowsHide: true,
        })
        assert.equal(child.error, undefined)
        assert.equal(child.status, 0, child.stderr || child.stdout)
        const output = JSON.parse(child.stdout)
        assert.equal(output.result.success, false)
        assert.equal(output.result.softFailure, variant !== 'hard')
        assert.equal(output.result.failureKind, variant === 'hard' ? 'hard_failure' : 'native_role_unavailable')
        assert.equal(output.resultHasPartial, ['true', 'hard'].includes(variant))
        if (['true', 'hard'].includes(variant)) assert.equal(output.result.partial, true)
        assert.equal(output.latest.partial, ['true', 'hard'].includes(variant) ? true : null)
        assert.equal(output.history.partial, ['true', 'hard'].includes(variant) ? true : null)
        assert.equal(output.history.success, false)
        assert.equal(output.latest.success, false)
        assert.equal(output.latest.jobs, null)
        assert.equal(output.latest.eligibleJobs, null)
        assert.equal(output.history.jobsFound, null)
        assert.equal(output.history.eligibleJobsFound, null)
        assert.equal(output.history.inventoryEvidence, null)
        assert.equal(output.complete, false)
        assert.deepEqual(output.cleanup, { replaceExisting: false })
        assert.equal(output.advancedCompleteCounts, false)
        assert.equal(output.sourceCalls, 1)
        assert.equal(output.saveCalls, 0)
        assert.equal(output.rawFailures, 1)
        assert.equal(output.DB, 0)
        assert.equal(output.nativeHTTP, 0)
      })
    }
  }
}
