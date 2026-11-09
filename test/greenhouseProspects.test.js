import assert from 'node:assert/strict'
import test from 'node:test'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import { attachGreenhouseSourceEvidence } from '../scraper-support/utils/greenhouseSourceEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

globalThis.fetch = async () => assert.fail('Prospect tests must use injected native responses')
const board = 'https://job-boards.eu.greenhouse.io/eqtpartners'
const provider = { source: 'eqtab', companyName: 'EQT AB', companyCareerPage: 'https://eqtgroup.com/about/careers',
  atsPlatform: 'greenhouse', boardToken: 'eqtpartners', sourceScopeComplete: true }
const row = (id, title, location, internalJobId) => ({ id, title, location: { name: location }, internal_job_id: internalJobId,
  absolute_url: `${board}/jobs/${id}`, offices: [], metadata: [],
  content: '&lt;p&gt;Build reliable employer services and maintain production integrations.&lt;/p&gt;',
})
const records = () => [row(4852704101, 'Investment Professional Associate Community', 'Europe (Region)', null),
  row(4936187101, 'AI Architect', 'Stockholm, Stockholm, Sweden', 4504933101),
  row(4282949101, "EQT's Talent Community", 'Global', null)]
const core = async (jobs = records(), envelope = {}) => {
  const payload = { jobs, meta: { total: jobs.length }, ...envelope }, original = structuredClone(payload)
  const result = await createPublishingGapAtsScraper(provider).run({ fetchJson: async () => payload })
  assert.deepEqual(payload, original, 'The complete published-post inventory must remain intact')
  return result
}

test('native Greenhouse prospect posts do not create unresolved vacancy geography', async () => {
  const jobs = await core()
  const evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 3, 'The native total still includes both prospect posts')
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.status, 'complete-inventory')
  assert.match(evidence.reason, /native-prospect-posts-excluded:/)
})

test('a prospect with an ordinary role title cannot be published as an India vacancy', async () => {
  const jobs = await core([row(1, 'Software Engineer', 'Bengaluru, India', null),
    row(2, 'Investment Professional Associate Community', 'Bengaluru, India', 20)])
  assert.equal(jobs.length, 1)
  assert.equal(String(jobs[0].jobId), '2')
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('missing or non-null internal IDs never classify an ordinary post as a prospect', async () => {
  for (const value of [undefined, '', 0, false, 50]) {
    const record = row(1, 'Software Engineer', 'Bengaluru, India', value)
    if (value === undefined) delete record.internal_job_id
    const jobs = await core([record])
    assert.equal(jobs.length, 1, String(value))
    assert.doesNotMatch(readInventoryEvidence(jobs).reason, /native-prospect-posts-excluded/)
  }
})

test('an unresolved vacancy remains incomplete beside a proven prospect', async () => {
  const jobs = await core([records()[0], row(2, 'Engineer', 'Europe (Region)', 20)])
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('prospect exclusions cannot invent a native total or hide truncation and failed envelopes', async () => {
  const missing = await core([records()[0]], { meta: undefined })
  assert.equal(readInventoryEvidence(missing).listingComplete, false)
  assert.equal(readInventoryEvidence(missing).reportedTotal, null)
  for (const envelope of [{ meta: { total: 4 } }, { hasMore: true }, { error: 'native API unavailable' }]) {
    await assert.rejects(core(records(), envelope), /inventory/)
  }
})

test('prospect identity errors and duplicates remain visible before mapping exclusions', async () => {
  for (const changed of [{ ...records()[0], id: null }, { ...records()[0], title: '' },
    { ...records()[0], absolute_url: null }]) await assert.rejects(core([changed]), /identity|inventory|URL|record/)
  await assert.rejects(core([records()[0], records()[0]]), /identity|inventory|duplicate|repeated/)
})

test('source-specific Greenhouse mappers drop proven prospects but preserve original native totals', async () => {
  const prospect = row(1, 'Software Engineer', 'Bengaluru, India', null)
  const input = [{ jobId: '1', country: 'India', location: 'Bengaluru, India', jobDescription: 'Build reliable employer services.' }]
  const jobs = await attachGreenhouseSourceEvidence(input, { ...provider,
    payload: { jobs: [prospect], meta: { total: 1 } },
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

test('source-specific prospect exclusion rejects failed and truncated native envelopes', async () => {
  for (const envelope of [{ hasMore: true }, { ok: false }, { status: 500 }, { failed: true }]) {
    await assert.rejects(attachGreenhouseSourceEvidence([], { ...provider,
      payload: { jobs: [records()[0]], meta: { total: 1 }, ...envelope },
    }), /inventory|envelope|upstream/)
  }
})

test('registered EQT AB reconciles the full employer board including its advertised prospect IDs', async () => {
  const current = getScraperCatalog().find(value => value.source === 'eqtab'), requests = []
  const jobs = await createCatalogScraper(current).run({
    fetchPage: async url => { requests.push(url); return { status: 200, url, html: `<a href="${board}">See all jobs</a>`
      + `<a href="${board}/jobs/4282949101">Connect with us</a>` } },
    fetchJson: async url => { requests.push(url); return { jobs: records(), meta: { total: 3 } } },
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.deepEqual(requests, ['https://eqtgroup.com/about/careers', 'https://boards-api.greenhouse.io/v1/boards/eqtpartners/jobs?content=true'])
})

test('EQT AB still requires a current full-board handoff and rejects other hiring inventories', async () => {
  const current = getScraperCatalog().find(value => value.source === 'eqtab')
  const run = html => createCatalogScraper(current).run({ fetchPage: async url => ({ status: 200, url, html }),
    fetchJson: async () => ({ jobs: records(), meta: { total: 3 } }),
  })
  await assert.rejects(run('<h1>Careers</h1>'), /binding|handoff/)
  const jobs = await run(`<a href="${board}">See all jobs</a><a href="https://jobs.ashbyhq.com/another-employer">Other roles</a>`)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
