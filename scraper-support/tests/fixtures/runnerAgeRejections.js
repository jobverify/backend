// The actual runner with isolated providers/persistence; no registered source,
// public HTTP, configured database, alerts or canonical dry-run artifacts.
import { registerHooks } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'

const scenario = process.argv[2]
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-age-runner-'))
const block = () => { throw new Error('Unexpected network in isolated runner fixture') }
globalThis.fetch = http.request = http.get = https.request = https.get = block
const now = Date.now()
const roles = [0, 100, 101].map((days, i) => ({
  jobId: `fixture-${i}`, title: 'Engineer', city: 'Bengaluru', location: 'Bengaluru, India',
  applyUrl: `https://example.test/jobs/${i}`, description: 'Build and maintain software for customers.',
  postingDate: new Date(now - days * 86_400_000).toISOString(),
}))
const state = { started: 0, writes: 0, startupClears: 0, statuses: [], history: null, error: null }
globalThis.runnerAgeFixture = {
  scrapers: [{ name: 'age-fixture', dryRunFile: path.join(directory, 'snapshot.json'),
    provider: { source: 'age-fixture', dryRunEnrichPublicExperience: false },
    run: async () => {
      state.started++
      if (scenario === 'source-failure') throw Object.assign(new Error('Fixture upstream unavailable'), { abortRetries: true })
      return scenario === 'all-old' ? roles.slice(1) : roles
    },
  }],
  save: async (_jobs, _source, options = {}) => {
    state.writes++
    state.authoritativeEmpty = options.authoritativeEmpty ?? null
    if (scenario === 'persistence-pending') throw Object.assign(new Error('Fixture classification pending'), { classificationPending: true })
    return { inserted: 1 } // Saver deliberately does not supply rejection counts.
  },
  clear: () => { state.startupClears++; throw new Error('Unexpected startup job clearing') },
  status: (_source, result) => state.statuses.push(structuredClone(result)),
  history: (_ranAt, result) => { state.history = structuredClone(result) },
}
const stubs = new Map([
  [new URL('../../providers/index.js', import.meta.url).href, 'export const buildScrapers = () => globalThis.runnerAgeFixture.scrapers'],
  [new URL('../../utils/saveToDB.js', import.meta.url).href, `
    export const saveToDB = (...args) => globalThis.runnerAgeFixture.save(...args)
    export const saveDryRunSnapshot = (...args) => globalThis.runnerAgeFixture.save(...args)
    export const clearExistingJobs = () => globalThis.runnerAgeFixture.clear()
    export const purgeExpiredJobsForQuotaRecovery = async () => { throw new Error('Unexpected purge') }
  `],
  [new URL('../../utils/scraperPersistence.js', import.meta.url).href, `
    export const ensureScrapersSeeded = async () => {}
    export const markPipelineRunStarted = async () => {}
    export const markPipelineRunFinished = async () => {}
    export const readPreviousScraperRun = async () => null
    export const upsertScraperStatus = async (...args) => globalThis.runnerAgeFixture.status(...args)
    export const writeScraperRun = async (...args) => globalThis.runnerAgeFixture.history(...args)
  `],
  [new URL('../../utils/rawCapture.js', import.meta.url).href, `
    export const saveRawSourceCapture = async () => null
    export const saveRawSourceFailure = async () => null
  `],
  [new URL('../../../src/models/ScraperStatus.js', import.meta.url).href,
    'export default { findOne: () => ({ lean: () => ({ exec: async () => ({ isActive: true }) }) }) }'],
  [new URL('../../../src/services/jobDatasetSummaryService.js', import.meta.url).href,
    'export const refreshJobDatasetSummary = async () => {}'],
])
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
  if (key.startsWith('SCRAPER_')) delete process.env[key]
}
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/not-connected-fixture'
process.env.SCRAPER_CHECKPOINT_FILE = path.join(directory, 'checkpoint.json')
process.env.SCRAPER_DISABLE_DRY_RUN_PUBLIC_EXPERIENCE = '1'
process.env.SCRAPER_CONCURRENCY = '1'
console.log = console.warn = console.error = () => {}
try {
  const { runAll } = await import('../../runner.js')
  state.summary = await runAll()
} catch (error) {
  state.error = { name: error.name, message: error.message }
} finally {
  state.checkpoint = JSON.parse(fs.readFileSync(process.env.SCRAPER_CHECKPOINT_FILE, 'utf8'))
  assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
  assert.match(path.basename(directory), /^jobverify-age-runner-/)
  fs.rmSync(directory, { recursive: true, force: true })
}
process.stdout.write(JSON.stringify(state))
