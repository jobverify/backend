import assert from 'node:assert/strict'
import test from 'node:test'
import * as renault from '../../scraper/renaultgroup/script.js'
import * as sphera from '../../scraper/spheraindia/script.js'
import { createCatalogScraper, getScraperCatalog, decorateJobsWithProviderMetadata } from '../providers/index.js'
import { attachInventoryEvidence, readInventoryEvidence, mapJobsWithInventoryEvidence, isCompleteScraperAttempt } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { readInventoryDelegationEvidence } from '../utils/inventoryDelegationEvidence.js'
import { buildScraperAttemptDiagnostics, isAuthoritativeEmptyScrape, resolveZeroJobOutcome } from '../runner.js'
import { inventoryCleanupOptions, finishScraperProcessing } from '../utils/scraperOutcome.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { readNativeRoleAvailability } from '../utils/sourceAvailability.js'

// Controlled native-format models reuse the existing Renault/Sphera test values.
// They are not current public captures, company censuses, or legal-employer proof.
const renaultHome = '<h1>Renault Group</h1><p>Careers</p><a href="https://www.renaultgroup.com/en/careers/">Careers</a>'
const renaultCareers = '<h1>A career at the centre of the automotive revolution</h1><p>Joining Renault Group means being part of a pioneering automotive company.</p><h2>Find your next job</h2><a href="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers">View our offers</a><p>ReKnow University</p>'
const renaultBoard = '<link rel="canonical" href="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers"><meta property="og:title" content="Careers | Renault Group"><meta property="og:url" content="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers">'
const spheraCareers = '<h1>Come work with us!</h1><p>Worldwide opportunities</p><a href="https://sphera.wd1.myworkdayjobs.com/careers">See all jobs</a><a href="https://sphera.wd1.myworkdayjobs.com/careers">See jobs in technology</a>'
const spheraBootstrap = '<html><head><title>Sphera Careers</title></head><body><main><h1>Open Jobs</h1></main></body></html>'
const spheraDetail = '<dl><dt>Locations</dt><dd>Bangalore, India</dd></dl><dl><dt>Department</dt><dd>Engineering</dd></dl><dl><dt>Requisition ID</dt><dd>R12345</dd></dl><section data-automation-id="jobPostingDescription"><div>Build resilient sustainability workflows for enterprise customers.</div></section>'
const spheraRows = Object.freeze([
  Object.freeze({ title: 'Senior Software Engineer', locationsText: 'Bangalore, India', externalPath: '/job/Bangalore-India/Senior-Software-Engineer_R12345' }),
  Object.freeze({ title: 'Account Executive', locationsText: 'Chicago, Illinois', externalPath: '/job/Chicago-Illinois/Account-Executive_R54321' }),
])
const fixtureRole = Object.freeze({ title: 'Officer - Process Associate Accounts Payable', location: 'Chennai, India', country: 'India', source: 'renaultgroup', company: 'Renault Group', jobId: 'JOBREQ_50268105', link: 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers/job/Chennai/Officer---Process-Associate-Accounts-Payable_JOBREQ_50268105' })
const boardProof = Symbol.for('jobverify.workday.country-inventory-proof')
const authoritativeEmpty = Symbol.for('jobverify.workday.authoritative-empty')
const delegation = Symbol.for('jobverify.inventory-delegation-evidence')
const providerFor = source => getScraperCatalog().find(provider => provider.source === source)
const response = (url, body, type = 'text/html') => { const value = new Response(body, { status: 200, headers: { 'content-type': type } }); Object.defineProperty(value, 'url', { value: url }); return value }
const renaultPage = async url => ({ status: 200, url, html: url === renault.HOMEPAGE_URL ? renaultHome : url === renault.CAREERS_URL ? renaultCareers : url === renault.WORKDAY_BOARD_URL ? renaultBoard : assert.fail('Unexpected Renault wrapper route') })
async function observeEngineMap(source, operation) {
  const original = Array.prototype.map, hits = []
  Array.prototype.map = function (mapper, thisArg) {
    const inventory = readInventoryEvidence(this), snapshot = inventory ? structuredClone(this) : null
    const output = original.call(this, mapper, thisArg)
    if (inventory && String(new Error().stack).replaceAll('\\', '/').includes('/scraper/' + source + '/script.js:')) hits.push({ input: this, snapshot, inventory: structuredClone(inventory) })
    return output
  }
  try { const jobs = await operation(); assert.equal(hits.length, 1); assert.deepEqual(hits[0].input, hits[0].snapshot); return { jobs, upstream: hits[0] } } finally { Array.prototype.map = original }
}
function assertPartialDiagnostics(jobs, upstream, source, status) {
  const evidence = readInventoryEvidence(jobs), observed = readSourceObservationEvidence(jobs, source), provider = providerFor(source)
  assert.ok(evidence, 'Qualified engine diagnostics must survive the source and provider maps')
  assert.equal(evidence.status, status)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.surface, upstream.inventory.surface)
  assert.equal(evidence.pagesFetched, upstream.inventory.pagesFetched)
  assert.equal(evidence.verifiedAt, upstream.inventory.verifiedAt)
  assert.match(evidence.reason, /scope|completeness|unverified/i)
  assert.doesNotMatch(evidence.reason, /observed-workday-board=|^\s*\{/)
  assert.deepEqual(observed, { source, recordKind: 'vacancy-rows', observedRecordCount: upstream.input.length, observedVacancyCount: upstream.input.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  const analysis = analyzePublishableJobs(jobs), diagnostics = buildScraperAttemptDiagnostics(jobs, analysis, provider), completedAt = new Date().toISOString()
  assert.equal(diagnostics.rawRecords, jobs.length, 'Observed rows must never be copied from the reported board total')
  assert.equal(isCompleteScraperAttempt({ success: true, ...diagnostics, completedAt }), false)
  assert.deepEqual(inventoryCleanupOptions(diagnostics), { replaceExisting: false })
  assert.equal(finishScraperProcessing({ success: true, ...diagnostics, completedAt }).partial, true)
  assert.equal(isAuthoritativeEmptyScrape({ name: source, provider }, jobs), false)
  assert.equal(jobs[boardProof], undefined)
  assert.equal(jobs[authoritativeEmpty], undefined)
  assert.equal(readInventoryDelegationEvidence(jobs), null)
  assert.ok(jobs.every(job => readNativeRoleAvailability(job) === null))
  return { analysis, diagnostics }
}

test('Renault registered real-engine empty retains unverified diagnostics and unknown company totals', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    url = String(url)
    if (url.startsWith(renault.WORKDAY_BOARD_URL + '?')) return response(url, renaultBoard)
    assert.equal(url, renault.WORKDAY_JOBS_API_URL); assert.equal(init.method, 'POST')
    return response(url, JSON.stringify({ total: 0, jobPostings: [] }), 'application/json')
  })
  const { jobs, upstream } = await observeEngineMap(renault.SOURCE, () => createCatalogScraper(providerFor(renault.SOURCE)).run({ fetchPage: renaultPage }))
  assert.equal(upstream.inventory.status, 'unverified')
  assert.equal(upstream.input.length, 0)
  assert.equal(jobs.length, 0)
  assertPartialDiagnostics(jobs, upstream, renault.SOURCE, 'unverified')
  assert.equal(resolveZeroJobOutcome({ provider: providerFor(renault.SOURCE) }, jobs, []), 'unverified-zero')
})

test('Sphera registered real-engine rows retain qualified observations without complete parent-board authority', async () => {
  const requests = []
  const fetchImpl = async (value, init = {}) => {
    const url = String(value); requests.push({ url, method: init.method || 'GET' })
    if (url === sphera.CAREERS_URL) return response(url, spheraCareers)
    if (url.startsWith(sphera.WORKDAY_BOARD_URL + '?')) return response(url, spheraBootstrap)
    if (url === 'https://sphera.wd1.myworkdayjobs.com/wday/cxs/sphera/careers/jobs') {
      assert.equal(init.method, 'POST')
      return response(url, JSON.stringify({ total: 2, jobPostings: spheraRows }), 'application/json')
    }
    if (url === 'https://sphera.wd1.myworkdayjobs.com/careers/job/Bangalore-India/Senior-Software-Engineer_R12345') return response(url, spheraDetail)
    throw new Error('Structured details absent from this existing HTML model: ' + url)
  }
  const { jobs, upstream } = await observeEngineMap(sphera.SOURCE, () => createCatalogScraper(providerFor(sphera.SOURCE)).run({ fetchImpl, retryBaseDelayMs: 0 }))
  assert.equal(upstream.inventory.status, 'complete-inventory')
  assert.equal(upstream.inventory.reportedTotal, 2)
  assert.equal(upstream.inventory.indiaFacetCount, 1)
  assert.equal(upstream.input.length, 1)
  assert.equal(jobs.length, 1)
  for (const key of Reflect.ownKeys(upstream.input[0]).filter(key => key !== 'city')) assert.deepEqual(jobs[0][key], upstream.input[0][key], key)
  assert.equal(jobs[0].requisitionId, 'R12345')
  assert.equal(jobs[0].jobDescription, upstream.input[0].jobDescription)
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].company, 'Sphera India')
  const { analysis } = assertPartialDiagnostics(jobs, upstream, sphera.SOURCE, 'coverage-gap')
  assert.equal(analysis.eligibleJobs.length, 1)
  assert.ok(requests.every(request => !request.url.includes('R54321')), 'Foreign listing is not hydrated or relabelled India')
  // Preserve the measured downstream hazard as a conditional regression: a blind
  // generic copy qualifies cleanup even though it has no country/delegation proof.
  const blind = decorateJobsWithProviderMetadata(mapJobsWithInventoryEvidence(upstream.input, (_job, index) => jobs[index]), providerFor(sphera.SOURCE))
  const blindAnalysis = analyzePublishableJobs(blind), blindDiagnostics = buildScraperAttemptDiagnostics(blind, blindAnalysis, providerFor(sphera.SOURCE))
  assert.equal(blindAnalysis.eligibleJobs.length, analysis.eligibleJobs.length)
  assert.equal(blindDiagnostics.detailHealth.complete, true)
  assert.equal(isCompleteScraperAttempt({ success: true, ...blindDiagnostics, completedAt: new Date().toISOString() }), true)
  assert.deepEqual(inventoryCleanupOptions(blindDiagnostics), {})
  assert.equal(blind[boardProof], undefined)
  assert.equal(readInventoryDelegationEvidence(blind), null)
})

test('Renault observed rows come from the returned array rather than a reported315 total', async () => {
  // Deliberately repeated fixture identity is a boundary model, never ten native vacancies.
  const rows = Array.from({ length: 10 }, () => ({ ...fixtureRole })), original = structuredClone(rows)
  attachInventoryEvidence(rows, { status: 'unverified', surface: renault.WORKDAY_JOBS_API_URL, firstParty: true, listingComplete: false, pagesFetched: 1, reportedTotal: 315, indiaFacetCount: 315, verifiedAt: '2026-08-04T00:00:00.000Z', reason: 'Controlled incomplete board page' })
  const jobs = await renault.createRenaultGroupScraper({ now: () => '2026-08-04T00:00:00.000Z' }).run({ fetchPage: renaultPage, runWorkday: async () => rows })
  assert.equal(jobs.length, 10)
  assert.deepEqual(rows, original)
  assertPartialDiagnostics(jobs, { input: rows, inventory: readInventoryEvidence(rows) }, renault.SOURCE, 'unverified')
  assert.equal(readSourceObservationEvidence(jobs, renault.SOURCE).observedRecordCount, 10)
  assert.equal(readSourceObservationEvidence(jobs, renault.SOURCE).observedVacancyCount, 10)
})

test('A verified-empty board model cannot become Renault company zero authority', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => response(String(url), init.method === 'POST' ? JSON.stringify({ total: 0, jobPostings: [] }) : renaultBoard, init.method === 'POST' ? 'application/json' : 'text/html'))
  const { jobs, upstream } = await observeEngineMap(renault.SOURCE, () => renault.run({ fetchPage: renaultPage, boardIdentityVerified: true }))
  assert.equal(upstream.inventory.status, 'verified-empty')
  assertPartialDiagnostics(jobs, upstream, renault.SOURCE, 'coverage-gap')
  assert.equal(resolveZeroJobOutcome({ provider: providerFor(renault.SOURCE) }, jobs, []), 'coverage-gap')
})

test('Renault bare injected rows do not manufacture a native inventory or observation proof', async () => {
  const jobs = await renault.run({ fetchPage: renaultPage, runWorkday: async () => [{ ...fixtureRole }] })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs), null)
  assert.equal(readSourceObservationEvidence(jobs, renault.SOURCE), null)
})

test('Foreign surface or company carriers cannot be relabelled as Renault observations', async () => {
  for (const foreign of ['surface', 'company']) {
    const rows = [{ ...fixtureRole, ...(foreign === 'company' ? { source: 'spheraindia', company: 'Sphera India' } : {}) }]
    attachInventoryEvidence(rows, { status: 'complete-inventory', surface: foreign === 'surface' ? 'https://sphera.wd1.myworkdayjobs.com/wday/cxs/sphera/careers/jobs' : renault.WORKDAY_JOBS_API_URL, firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 1, indiaFacetCount: 1, verifiedAt: '2026-08-04T00:00:00.000Z', reason: 'Controlled foreign carrier' })
    Object.defineProperty(rows, boardProof, { value: { controlledForeignMarker: true } })
    Object.defineProperty(rows, delegation, { value: { controlledForeignMarker: true } })
    const jobs = await renault.run({ fetchPage: renaultPage, runWorkday: async () => rows })
    assert.equal(jobs.length, 1)
    assert.equal(readInventoryEvidence(jobs), null)
    assert.equal(readSourceObservationEvidence(jobs, renault.SOURCE), null)
    assert.equal(jobs[boardProof], undefined)
    assert.equal(jobs[delegation], undefined)
  }
})
