import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { run } from './script.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence, isCompleteScraperAttempt } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata } from '../../scraper-support/providers/index.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractionRawJobMetrics } from '../../scraper-support/utils/extractionRawJobMetrics.js'

// Synthetic contract cases. Authentic current native response bodies are retained
// separately in the diagnostic report; these are not represented as live evidence.
const listing = (id, { country = 'India', city = 'Bengaluru', title = 'Engineer' } = {}) => `<jobVoList><jobSeq>${id}</jobSeq><jobTitle>${title}</jobTitle>${country ? `<jobLocation>${country}</jobLocation>` : '<jobLocation/>'}<locations>${city}</locations><jobId>REQ-${id}</jobId></jobVoList>`
const page = (start, total, rows, size = 2) => `<JobPageVO><startJobIndex>${start}</startJobIndex><maxJobSize>${size}</maxJobSize><totalJobCount>${total}</totalJobCount>${rows.join('')}</JobPageVO>`
const detail = (id, { city = 'Bengaluru', workplace = city } = {}) => `<CandidateJobVO><companyVO><companyCd>LTIMINDIA</companyCd></companyVO><jobVO><jobSeq>${id}</jobSeq><jobTitle>Engineer</jobTitle><jobId>REQ-${id}</jobId><jobLocation>${workplace}</jobLocation><locations>${city}</locations><jobDesc><![CDATA[Build and maintain reliable software services.]]></jobDesc></jobVO></CandidateJobVO>`
const isSearch = url => url.endsWith('/candidatejobsearch')
const parameters = options => JSON.parse(new URLSearchParams(options.body).get('careerSiteUrlParams'))
const gap = error => error.inventoryEvidence?.status === 'coverage-gap' && error.inventoryEvidence.reportedTotal === null && error.inventoryEvidence.indiaFacetCount === null

test('native query reconciliation requires every opening page and a matching full closing sweep', async () => {
  let searches = 0
  const jobs = await run({ pageSize: 2, fetchText: async (url, options) => {
    if (!isSearch(url)) return detail(new URL(url).searchParams.get('jobSeq'))
    searches += 1
    return parameters(options).page === 0 ? page(0, 3, [listing('1'), listing('2')]) : page(2, 3, [listing('3')])
  } })
  assert.deepEqual(jobs.map(job => job.jobId), ['1', '2', '3'])
  assert.equal(searches, 4)
  assert.deepEqual(readInventoryEvidence(jobs), { status: 'coverage-gap', surface: 'https://ltimindtree.ripplehire.com/candidate/?token=xviyQvbnyYZdGtozXoNm&lang=en&source=CAREERSITE#list/geo=India', firstParty: true, listingComplete: false, pagesFetched: 4, reportedTotal: null, indiaFacetCount: null, verifiedAt: readInventoryEvidence(jobs)?.verifiedAt, reason: 'ltimindtree-native-india-query-opening-details-and-closing-reconciled;company-totals-and-cleanup-unverified' })
  assert.equal(jobs.nativeInventory.closingStable, true)
  assert.deepEqual(jobs.nativeInventory.enumeratedIds, ['1', '2', '3'])
  assert.equal(jobs.nativeInventory.companyGlobalTotal, null)
  assert.equal(jobs.nativeInventory.companyIndiaTotal, null)
  assert.equal(jobs.nativeInventory.lifecycleCleanupAllowed, false)
})

test('a changed closing ID set never receives complete inventory evidence', async () => {
  let searches = 0
  await assert.rejects(run({ pageSize: 2, fetchText: async (url) => {
    if (!isSearch(url)) return detail(new URL(url).searchParams.get('jobSeq'))
    return page(0, 1, [listing(++searches === 1 ? '1' : '2')])
  } }), error => gap(error) && /closing|changed/i.test(error.message))
})

test('a changed closing workplace with the same ID is not a stable inventory', async () => {
  let searches = 0
  await assert.rejects(run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page(0, 1, [listing('1', { city: ++searches === 1 ? 'Bengaluru' : 'Hyderabad' })])
    : detail('1') }), error => gap(error) && /closing|changed/i.test(error.message))
})

test('a query and India company label cannot supply an unspecified job country', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page(0, 1, [listing('1', { country: null, city: 'Select Location' })])
    : detail('1', { city: 'Select Location' }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, null)
  assert.deepEqual(jobs.nativeInventory.unresolvedIds, ['1'])
  assert.equal(jobs.nativeInventory.queryReportedTotal, 1)
  assert.equal(jobs.nativeInventory.nativeRoles[0].country, null)
})

test('a shared bare city never supplies a missing typed country on another native role', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async (url, options) => {
    if (!isSearch(url)) return detail(new URL(url).searchParams.get('jobSeq'), { city: 'Kolkata' })
    return parameters(options).page === 0
      ? page(0, 3, [listing('1', { city: 'Kolkata' }), listing('2', { country: null, city: 'Kolkata' })])
      : page(2, 3, [listing('3', { country: null, city: 'Kolkata, Unknown Campus' })])
  } })
  assert.deepEqual(jobs.map(job => job.jobId), ['1'])
  assert.deepEqual(jobs.nativeInventory.unresolvedIds, ['2', '3'])
  assert.equal(jobs.nativeInventory.nativeRoles[1].country, null)
  assert.match(jobs.nativeInventory.nativeRoles[1].jobDescription, /Build and maintain/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a missing native detail ID cannot be filled from the listing', async () => {
  await assert.rejects(run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page(0, 1, [listing('1')]) : detail('1').replace('<jobSeq>1</jobSeq>', '') }), error => gap(error) && /detail|identity/i.test(error.message))
})

test('malformed native response wrappers cannot provide inventory or job detail proof', async () => {
  for (const body of [page(0, 0, []).replace('</JobPageVO>', ''), '<html>Temporary failure</html>']) {
    await assert.rejects(run({ pageSize: 2, fetchText: async () => body }), gap)
  }
  for (const body of [detail('1').replace('</CandidateJobVO>', ''), detail('1') + 'An unexpected error occurred']) {
    await assert.rejects(run({ pageSize: 2, fetchText: async url => isSearch(url)
      ? page(0, 1, [listing('1')]) : body }), gap)
  }
})

test('pre-cancelled calls preserve the exact reason and never start a request', async () => {
  const controller = new AbortController()
  const reason = { caller: 'stop before starting' }
  controller.abort(reason)
  let calls = 0
  await assert.rejects(run({ signal: controller.signal, fetchText: async () => { calls += 1; return page(0, 0, [], 10) } }), error => error === reason)
  assert.equal(calls, 0)
})

test('an ignored pending listing reader cancels promptly and cannot queue later pages', async () => {
  const controller = new AbortController()
  const reason = { caller: 'stop during listing' }
  let release
  let calls = 0
  const pending = run({ pageSize: 2, signal: controller.signal, fetchText: async () => {
    calls += 1
    return new Promise(resolve => { release = resolve })
  } })
  await delay(5)
  controller.abort(reason)
  const outcome = await Promise.race([pending.then(() => 'resolved', error => error), delay(80, 'did-not-cancel')])
  assert.equal(outcome, reason)
  release(page(0, 3, [listing('1'), listing('2')]))
  await delay(20)
  assert.equal(calls, 1)
})

test('cancellation while details are pending stops the queue after late resolutions', async () => {
  const controller = new AbortController()
  const reason = { caller: 'stop during details' }
  const releases = []
  let detailCalls = 0
  const pending = run({ pageSize: 3, detailConcurrency: 2, signal: controller.signal, fetchText: async url => {
    if (isSearch(url)) return page(0, 3, [listing('1'), listing('2'), listing('3')], 3)
    const id = new URL(url).searchParams.get('jobSeq')
    detailCalls += 1
    return new Promise(resolve => { releases.push(() => resolve(detail(id))) })
  } })
  await delay(5)
  controller.abort(reason)
  const outcome = await Promise.race([pending.then(() => 'resolved', error => error), delay(80, 'did-not-cancel')])
  assert.equal(outcome, reason)
  releases.forEach(release => release())
  await delay(20)
  assert.equal(detailCalls, 2)
})

test('default HTTP body readers cancel without retrying when the caller stops', async () => {
  const original = globalThis.fetch
  const controller = new AbortController()
  const reason = { caller: 'stop native body' }
  let calls = 0
  let cancelled = 0
  globalThis.fetch = async () => {
    calls += 1
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
      body: { cancel: async () => { cancelled += 1 } }, text: async () => new Promise(() => {}) }
  }
  try {
    const pending = run({ signal: controller.signal })
    await delay(5)
    controller.abort(reason)
    const outcome = await Promise.race([pending.then(() => 'resolved', error => error), delay(80, 'did-not-cancel')])
    assert.equal(outcome, reason)
    await delay(20)
    assert.equal(calls, 1)
    assert.equal(cancelled, 1)
  } finally { globalThis.fetch = original }
})

test('an ignored default fetch cancels its late response body without starting a reader', async () => {
  const original = globalThis.fetch
  const controller = new AbortController()
  const reason = { caller: 'stop before native response' }
  let release
  let cancelled = 0
  let bodyReads = 0
  globalThis.fetch = async () => new Promise(resolve => { release = resolve })
  try {
    const pending = run({ signal: controller.signal })
    await delay(5)
    controller.abort(reason)
    assert.equal(await Promise.race([pending.then(() => 'resolved', error => error), delay(80, 'did-not-cancel')]), reason)
    release({ status: 200, body: { cancel: async () => { cancelled += 1 } }, text: async () => { bodyReads += 1; return page(0, 0, [], 10) } })
    await delay(20)
    assert.equal(cancelled, 1)
    assert.equal(bodyReads, 0)
  } finally { globalThis.fetch = original }
})

test('a reconciled positive India query cannot authorize source completion before or after provider decoration', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page(0, 1, [listing('1')]) : detail('1') })
  const decorated = decorateJobsWithProviderMetadata(jobs, { source: 'ltimindtree', companyName: 'LTIMindtree' })
  for (const output of [jobs, decorated]) {
    const evidence = readInventoryEvidence(output)
    assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
    assert.equal(isCompleteScraperAttempt({ success: true, completedAt: evidence.verifiedAt, inventoryEvidence: evidence }), false)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
    assert.ok(output.every(job => job.sourceListingComplete === false && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  }
  assert.equal(jobs.nativeInventory.queryReportedTotal, 1)
  assert.equal(jobs.nativeInventory.queryEnumerationComplete, true)
  assert.equal(jobs.nativeInventory.closingStable, true)
})

test('a reconciled zero India query cannot become authoritative empty or source completion after decoration', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async () => page(0, 0, []) })
  const decorated = decorateJobsWithProviderMetadata(jobs, { source: 'ltimindtree', companyName: 'LTIMindtree' })
  for (const output of [jobs, decorated]) {
    const evidence = readInventoryEvidence(output)
    assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
    assert.equal(isCompleteScraperAttempt({ success: true, completedAt: evidence.verifiedAt, inventoryEvidence: evidence }), false)
    assert.equal(evidence.status, 'coverage-gap')
    assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null)
  }
  assert.equal(jobs.nativeInventory.queryReportedTotal, 0)
  assert.deepEqual(jobs.nativeInventory.enumeratedIds, [])
  assert.equal(jobs.nativeInventory.queryEnumerationComplete, true)
})

test('provider decoration and JSON preserve detached immutable native observations with unknown countries', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page(0, 2, [listing('1'), listing('2', { country: null, city: 'Select Location' })])
    : detail(new URL(url).searchParams.get('jobSeq')) })
  const decorated = decorateJobsWithProviderMetadata(jobs, { source: 'ltimindtree', companyName: 'LTIMindtree' })
  const preserved = decorated[0].nativeCollectionEvidence
  assert.equal(preserved?.source, 'ltimindtree')
  assert.deepEqual(preserved.unresolvedIds, ['2'])
  assert.equal(preserved.nativeRoles[1].country, null)
  assert.match(preserved.nativeRoles[1].jobDescription, /Build and maintain/)
  assert.ok(Object.isFrozen(preserved) && Object.isFrozen(preserved.nativeRoles) && Object.isFrozen(preserved.nativeRoles[1]))
  assert.throws(() => { preserved.nativeRoles[1].country = 'India' }, TypeError)
  const originalDescription = preserved.nativeRoles[0].jobDescription
  jobs[0].jobDescription = 'Caller mutated the returned job'
  assert.equal(preserved.nativeRoles[0].jobDescription, originalDescription)
  const roundTripped = JSON.parse(JSON.stringify(decorated))[0].nativeCollectionEvidence
  assert.equal(roundTripped.nativeRoles[1].country, null)
  assert.deepEqual(roundTripped.unresolvedIds, ['2'])
  assert.equal(roundTripped.lifecycleCleanupAllowed, false)
  assert.equal(roundTripped.companyIndiaTotal, null)
})

test('a malformed native detail emits a typed coverage gap without refreshing source authority', async () => {
  await assert.rejects(run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page(0, 1, [listing('1')]) : detail('1') + 'An unexpected error occurred' }), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.softFailure, true)
    assert.equal(error.abortRetries, true)
    assert.equal(isFreshCompleteInventoryEvidence(error.inventoryEvidence), false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    return true
  })
})

test('unknown-only and mixed native vacancy queries retain observed raw counts after provider decoration', async () => {
  const provider = { source: 'ltimindtree', companyName: 'LTIMindtree' }
  for (const explicitIndia of [false, true]) {
    const jobs = await run({ pageSize: 2, fetchText: async url => isSearch(url)
      ? page(0, 2, [listing('1', { country: explicitIndia ? 'India' : null }), listing('2', { country: null, city: 'Select Location' })])
      : detail(new URL(url).searchParams.get('jobSeq')) })
    assert.equal(jobs.length, explicitIndia ? 1 : 0)
    const decorated = decorateJobsWithProviderMetadata(jobs, provider)
    for (const output of [jobs, decorated]) {
      const evidence = readInventoryEvidence(output)
      assert.deepEqual(extractionRawJobMetrics(provider, output, evidence), {
        rawJobs: 2, rawJobsBasis: 'observed-native-vacancy-rows',
      })
      const observations = readSourceObservationEvidence(output, provider.source)
      assert.equal(observations.observedVacancyCount, 2)
      assert.equal(observations.companyIndiaTotal, null)
      assert.equal(observations.companyGlobalTotal, null)
      assert.equal(observations.sourceScopeComplete, false)
      assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
      assert.equal(evidence.reportedTotal, null)
      assert.equal(evidence.indiaFacetCount, null)
    }
    assert.equal(jobs.nativeInventory.nativeRoles[1].country, null)
  }
})

test('an observed empty native query preserves zero observation counts without authorizing company cleanup', async () => {
  const provider = { source: 'ltimindtree', companyName: 'LTIMindtree' }
  const jobs = await run({ pageSize: 2, fetchText: async () => page(0, 0, []) })
  const decorated = decorateJobsWithProviderMetadata(jobs, provider)
  assert.deepEqual(extractionRawJobMetrics(provider, decorated, readInventoryEvidence(decorated)), {
    rawJobs: 0, rawJobsBasis: 'observed-native-vacancy-rows',
  })
  assert.equal(readSourceObservationEvidence(decorated, provider.source)?.observedRecordCount, 0)
  assert.equal(isCompleteScraperAttempt({ success: true, completedAt: readInventoryEvidence(decorated).verifiedAt,
    inventoryEvidence: readInventoryEvidence(decorated) }), false)
})
