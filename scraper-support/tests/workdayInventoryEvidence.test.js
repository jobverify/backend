import assert from 'node:assert/strict'
import nodeTest from 'node:test'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper as runWorkdayScraperImpl } from '../myworkday/engine.js'
import {
  isVerifiedEmptyEvidence,
  readInventoryEvidence,
} from '../utils/inventoryEvidence.js'

const test = (name, fn) => nodeTest(name, { concurrency: false }, fn)
const scraperDir = fileURLToPath(new URL('../myworkday', import.meta.url))
const requestScheduler = { acquire: async () => () => {}, recordRateLimit: () => {} }
const runWorkdayScraper = (options) => runWorkdayScraperImpl({ requestScheduler, ...options })

const buildOptions = (overrides = {}) => ({
  company: 'Evidence Fixture',
  baseUrl: 'https://evidence-fixture.wd5.myworkdayjobs.com/External',
  locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
  source: 'workday-evidence-fixture',
  scraperDir,
  requestTimeoutMs: 1000,
  retryBaseDelayMs: 0,
  ...overrides,
})

const mockWorkdayFetch = (t, payload) => {
  t.mock.method(globalThis, 'fetch', async (_url, init = {}) => (
    init.method === 'POST'
      ? new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
      : new Response('<html><body>Workday careers</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
  ))
}

test('Workday zero remains unverified without explicit board identity verification', async (t) => {
  mockWorkdayFetch(t, { total: 0, jobPostings: [] })

  const jobs = await runWorkdayScraper(buildOptions({ boardIdentityVerified: false }))

  assert.equal(readInventoryEvidence(jobs)?.status, 'unverified')
  assert.equal(jobs[Symbol.for('jobverify.workday.authoritative-empty')], undefined)
})

test('verified Workday board emits authoritative empty evidence', async (t) => {
  mockWorkdayFetch(t, { total: 0, jobPostings: [] })

  const jobs = await runWorkdayScraper(buildOptions({ boardIdentityVerified: true }))
  const evidence = readInventoryEvidence(jobs)

  assert.equal(evidence?.status, 'verified-empty')
  assert.equal(evidence?.surface, 'https://evidence-fixture.wd5.myworkdayjobs.com/wday/cxs/evidence-fixture/External/jobs')
  assert.equal(evidence?.pagesFetched, 1)
  assert.equal(isVerifiedEmptyEvidence(evidence), true)
})

test('complete non-empty Workday enumeration carries complete inventory evidence', async (t) => {
  mockWorkdayFetch(t, {
    total: 1,
    jobPostings: [{
      title: 'Engineer',
      externalPath: '/job/Bangalore-India/Engineer_R1',
      locationsText: 'Bangalore, India',
      postedOn: 'Today',
    }],
  })

  const jobs = await runWorkdayScraper(buildOptions({
    boardIdentityVerified: true,
    detailEnrichmentBudgetMs: 0,
  }))

  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.status, 'complete-inventory')
})
