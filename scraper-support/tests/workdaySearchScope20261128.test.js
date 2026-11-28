import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { runWorkdayScraper } from '../myworkday/engine.js'
import { mapJobsWithInventoryEvidence, readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/workdayQ2SearchScope20261128.json.gz', import.meta.url))))
const COUNTRY = 'c4f78be1a8f14da0ab49ce1162348a5e'
const BOARD = 'https://search-scope.wd103.myworkdayjobs.com/Careers'
const API = 'https://search-scope.wd103.myworkdayjobs.com/wday/cxs/search-scope/Careers/jobs'
const ROW = { title: 'Software Engineer', externalPath: '/job/Bengaluru/Software-Engineer_R1', locationsText: 'Bengaluru, India', bulletFields: ['R1'], postedOn: 'Posted Today' }
const sha = value => createHash('sha256').update(value).digest('hex')
const scheduler = { acquire: async () => () => {}, recordRateLimit() {} }

function localConfig(t, config) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-search-scope-'))
  t.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-search-scope-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify(config))
  return directory
}
function heldSearch(jobs, expectedJobs) {
  assert.equal(jobs.length, expectedJobs)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, expectedJobs ? 'coverage-gap' : 'unverified')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.reportedTotal, null, 'a selected search count is not the India inventory total')
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /search/)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  for (const job of jobs) {
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  const assessment = assessSoftFailureAcquisition({ source: 'search-scope' }, jobs)
  assert.equal(assessment.cleanupOptions.replaceExisting, false)
  if (!expectedJobs) {
    assert.equal(assessment.runnerOutcome.success, false)
    assert.equal(assessment.runnerOutcome.failureKind, 'coverage_gap')
  }
  const mapped = mapJobsWithInventoryEvidence(jobs, job => ({ ...job }))
  assert.equal(sourceLifecycleCleanupForbidden(mapped), true, 'mapping and empty arrays retain the inventory cleanup hold')
}

test('the genuine Q2 fixture retains all fifteen response hashes and its actual restricted query', () => {
  assert.equal(fixture.source, 'q2ebanking')
  assert.equal(fixture.outcomeSHA256, '8004e385723729fa61c363da35ecad180d98aacbe6dc1ae08f922c6324be8ced')
  assert.equal(fixture.packets.length, 15)
  for (const packet of fixture.packets) assert.equal(sha(packet.body), packet.sha256)
  const listings = fixture.packets.filter(packet => packet.method === 'POST')
  assert.equal(listings.length, 1)
  assert.deepEqual(JSON.parse(listings[0].requestBody), { appliedFacets: {}, limit: 20, offset: 0, searchText: 'India' })
  assert.equal(JSON.parse(listings[0].body).total, 14)
  assert.equal(fixture.observedJobs.length, 13)
})

test('the full genuine Q2 search preserves thirteen native India roles while withholding inventory and cleanup authority', async t => {
  const pending = structuredClone(fixture.packets)
  const scraperDir = localConfig(t, fixture.config)
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const index = pending.findIndex(packet => packet.requestedUrl === String(input)
      && packet.method === (init.method || 'GET') && (packet.requestBody ?? null) === (init.body ?? null))
    assert.notEqual(index, -1, 'No live or substituted response is permitted: ' + input)
    const [packet] = pending.splice(index, 1)
    const response = new Response(packet.body, { status: packet.status, headers: packet.headers })
    Object.defineProperty(response, 'url', { value: packet.url })
    return response
  })
  const jobs = await runWorkdayScraper({ company: 'Q2', source: 'q2ebanking', baseUrl: fixture.baseUrl,
    scraperDir, boardIdentityVerified: true, nativeDetailRecovery: false,
    requestTimeoutMs: 2000, retryBaseDelayMs: 0, requestScheduler: scheduler })
  assert.equal(pending.length, 0, 'every genuine registered response is consumed once')
  const facts = rows => rows.map(job => [job.link, job.title, job.location, job.jobDescription, job.sourceDetailComplete])
    .sort((left, right) => left[0].localeCompare(right[0]))
  assert.deepEqual(facts(jobs), facts(fixture.observedJobs), 'observed roles and full source descriptions remain unchanged')
  heldSearch(jobs, 13)
})

// The following small response envelopes, facet rejections and known detail
// are synthetic protocol controls; they do not assert current publisher facts.
async function synthetic(t, { searchText = '', countryFacet = false, zero = false, rejects = 0, locationFacet = false } = {}) {
  const query = locationFacet ? '?locationCountry=' + COUNTRY + '&Location_Region_State_Province=opaque-state' : ''
  const baseUrl = BOARD + query
  const scraperDir = localConfig(t, { listingStrategy: 'jobs-api', jobsApiUrl: API, detailUrlBase: BOARD,
    locationCountry: countryFacet ? COUNTRY : null, searchText, detailEnrichmentBudgetMs: 1000 })
  const calls = []
  let postCalls = 0
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input)
    let response
    if (init.method === 'POST') {
      assert.equal(url, API)
      const request = JSON.parse(init.body)
      assert.equal(request.offset, 0)
      calls.push(request)
      response = ++postCalls <= rejects ? Response.json({ errorCode: 'HTTP_400', httpStatus: 400 }, { status: 400 })
        : Response.json({ total: zero ? 0 : 1, jobPostings: zero ? [] : [ROW] })
    } else if (url === API.slice(0, -5) + ROW.externalPath) {
      response = Response.json({ jobPostingInfo: { title: ROW.title, jobReqId: 'R1', location: 'Bengaluru, India',
        country: { alpha2Code: 'IN' }, externalUrl: BOARD + ROW.externalPath, startDate: '2026-11-27',
        jobDescription: '<p>Develop reliable distributed software and maintain production systems. Two years of professional engineering experience is required.</p>' } })
    } else {
      assert.equal(new URL(url).origin + new URL(url).pathname, BOARD, 'only the declared bootstrap is allowed')
      response = new Response('<html>Anonymous Workday bootstrap control</html>', { headers: { 'content-type': 'text/html' } })
    }
    Object.defineProperty(response, 'url', { value: url })
    return response
  })
  const jobs = await runWorkdayScraper({ company: 'Search Scope', source: 'search-scope', baseUrl, scraperDir,
    boardIdentityVerified: true, nativeDetailRecovery: false, requestTimeoutMs: 1000,
    retryBaseDelayMs: 0, requestScheduler: scheduler })
  return { jobs, calls }
}

for (const query of ['India', 'einfochips', 'platform architect', '*', ' \t ']) {
  test('opaque nonempty search cannot establish complete India inventory: ' + JSON.stringify(query), async t => {
    const { jobs, calls } = await synthetic(t, { searchText: query })
    assert.equal(calls[0].searchText, query)
    assert.equal(jobs[0].sourceDetailComplete, true)
    heldSearch(jobs, 1)
  })
}
for (const zero of [false, true]) test('an explicit country facet cannot expand a restricted ' + (zero ? 'zero' : 'positive') + ' search', async t => {
  const { jobs, calls } = await synthetic(t, { searchText: 'India', countryFacet: true, zero })
  assert.deepEqual(calls[0].appliedFacets, { locationCountry: [COUNTRY] })
  heldSearch(jobs, zero ? 0 : 1)
})
test('a restricted zero without a country facet remains unknown with an array cleanup hold', async t => {
  heldSearch((await synthetic(t, { searchText: 'India', zero: true })).jobs, 0)
})
test('rejected country facet recovery keeps valid roles without keyword inventory authority', async t => {
  const { jobs, calls } = await synthetic(t, { countryFacet: true, rejects: 1 })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].searchText, '')
  assert.deepEqual(calls[1].appliedFacets, {})
  assert.equal(calls[1].searchText, 'India')
  heldSearch(jobs, 1)
})
test('rejected country and remaining location facets retain a search-only cleanup hold', async t => {
  const { jobs, calls } = await synthetic(t, { countryFacet: true, locationFacet: true, rejects: 2 })
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[1].appliedFacets, { Location_Region_State_Province: ['opaque-state'] })
  assert.deepEqual(calls[2].appliedFacets, {})
  assert.equal(calls[2].searchText, 'India')
  heldSearch(jobs, 1)
})
test('unsearched explicit-country zero retains verified-empty authority', async t => {
  const { jobs } = await synthetic(t, { countryFacet: true, zero: true })
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
})
test('unsearched whole-board positive enumeration retains its existing authority', async t => {
  const { jobs } = await synthetic(t)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
})
