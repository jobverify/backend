import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { gunzipSync } from 'node:zlib'
import { run, buildSearchRequestPayload } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { decorateJobsWithProviderMetadata, buildScrapers } from '../../scraper-support/providers/index.js'
import { extractionRawJobMetrics } from '../../scraper-support/utils/extractionRawJobMetrics.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/2026-11-05-json-protocol.json.gz', import.meta.url)))).requests
const nativeListing = JSON.parse(packets.find(packet => packet.name === 'search-json').body)
const nativeDetails = packets.filter(packet => packet.name.startsWith('detail-json-')).map(packet => JSON.parse(packet.body))
const token = 'xviyQvbnyYZdGtozXoNm'
const isSearch = url => url.endsWith('/candidatejobsearch')
const parameters = options => JSON.parse(new URLSearchParams(options.body).get('careerSiteUrlParams'))
const gap = error => error?.failureKind === 'coverage_gap' && error.inventoryEvidence?.status === 'coverage-gap'
const rawMetrics = jobs => extractionRawJobMetrics({ source: 'ltimindtree', companyName: 'LTIMindtree' }, jobs, readInventoryEvidence(jobs))

// Modelled boundary cases below retain the native schema, but their IDs, counts,
// and descriptions are synthetic. Only packets above are genuine public bodies.
const row = (jobSeq, country = 'India') => ({ jobSeq, jobId: jobSeq, jobTitle: 'Software Engineer', jobLocation: country, locations: 'Bengaluru' })
const page = (rows, start = 0, total = rows.length, size = 2) => JSON.stringify({ startJobIndex: start, totalJobCount: total,
  maxJobSize: size, jobVoList: rows, errorStatus: 'success' })
const description = '<p>Build and maintain reliable distributed services. Review code, write automated tests, and diagnose production performance.</p>'
const detail = (jobSeq, fields = {}) => JSON.stringify({ jobSeq, linkDeactivated: false, nonErLinkDeactivated: false,
  companyVO: { companyMstrSeq: 72, parentCompanyMstrSeq: 51, companyCd: 'LTIMINDIA',
    companyName: 'LTM', domainName: 'ltm.ripplehire.com', additionalDomainName: 'ltimindtree.ripplehire.com' },
  jobVO: { jobSeq, jobId: jobSeq, jobTitle: 'Software Engineer', companySeq: 72, jobStatus: 'ACTIVE', allowCareerSite: 'Y',
    jobDesc: description, countryMstNewSeq: 1, locations: 'Bengaluru', jobLocation: 'Bengaluru', ...fields } })

test('genuine protocol bodies retain their original hashes and JSON exposes full descriptions', () => {
  assert.equal(packets.length, 6)
  for (const packet of packets) {
    const bytes = Buffer.from(packet.body)
    assert.equal(bytes.length, packet.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.sha256)
  }
  assert.equal(nativeListing.totalJobCount, 658)
  assert.equal(nativeListing.jobVoList.length, 100)
  for (const value of nativeDetails) {
    assert.equal(String(value.companyVO.parentCompanyMstrSeq), '51')
    assert.equal(String(value.companyVO.companyMstrSeq), '72')
    assert.equal(String(value.jobVO.countryMstNewSeq), '1')
    assert.ok(value.jobVO.jobDesc.length > 300)
  }
})

test('JSON protocol preserves full authored descriptions and exact published India query on both sweeps', async () => {
  const listing = nativeListing.jobVoList.find(value => String(value.jobSeq) === String(nativeDetails[0].jobSeq))
  const calls = []
  // This deliberately reduced listing is a model, not a 658-role live recheck.
  const jobs = await run({ pageSize: 2, fetchText: async (url, options) => {
    calls.push({ url, options })
    return isSearch(url) ? page([listing]) : JSON.stringify(nativeDetails[0])
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDescriptionHtml, nativeDetails[0].jobVO.jobDesc)
  assert.ok(jobs[0].jobDescription.length > 300)
  assert.equal(jobs[0].company, 'LTIMindtree')
  assert.equal(jobs[0].source, 'ltimindtree')
  assert.equal(calls.length, 3, 'the first native response must be consumed exactly once')
  for (const call of calls) {
    assert.equal(call.options.headers.Accept, 'application/json, text/javascript, */*; q=0.01')
    assert.equal(call.options.headers['X-Requested-With'], 'XMLHttpRequest')
    if (isSearch(call.url)) assert.deepEqual(parameters(call.options), buildSearchRequestPayload(0, 2))
  }
  assert.equal(jobs.nativeInventory.closingStable, true)
  assert.match(jobs.nativeInventory.queryScope, /#list\/geo=India$/)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('an unmapped numeric country ID cannot resolve a blank typed listing country', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page([row(1, 'India'), row(2, '')]) : detail(Number(new URL(url).searchParams.get('jobSeq'))) })
  assert.deepEqual(jobs.map(job => job.jobId), ['1'])
  assert.deepEqual(jobs.nativeInventory.unresolvedIds, ['2'])
  assert.equal(jobs.nativeInventory.nativeRoles[1].country, null)
  assert.equal(jobs.nativeInventory.nativeRoles[1].rawNativeCountryId, 1)
  const decorated = decorateJobsWithProviderMetadata(jobs, { source: 'ltimindtree', companyName: 'LTIMindtree' })
  assert.equal(rawMetrics(decorated).rawJobs, 2)
  assert.equal(readInventoryEvidence(decorated).listingComplete, false)
})

test('empty returned JSON jobs preserve observed rows through provider decoration', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async url => isSearch(url) ? page([row(1, '')]) : detail(1) })
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeInventory.queryEnumeratedCount, 1)
  assert.equal(rawMetrics(jobs).rawJobs, 1)
  assert.equal(rawMetrics(decorateJobsWithProviderMetadata(jobs, { source: 'ltimindtree', companyName: 'LTIMindtree' })).rawJobs, 1)
})

test('native placeholders and explicitly closed roles remain visible without suppressing a verified neighbor', async () => {
  const rows = [row(1), row(2), row(3)]
  const jobs = await run({ pageSize: 3, fetchText: async url => {
    if (isSearch(url)) return page(rows, 0, 3, 3)
    const jobSeq = Number(new URL(url).searchParams.get('jobSeq'))
    return detail(jobSeq, jobSeq === 2 ? { jobDesc: 'NULL' } : jobSeq === 3 ? { jobStatus: 'CLOSED' } : {})
  } })
  assert.deepEqual(jobs.map(job => job.jobId), ['1'])
  assert.deepEqual(jobs.nativeInventory.outcomeCounts, { publishedIndia: 1, nativeClosed: 1, unresolvedCountry: 0, nonIndia: 0, nativeDetailFailure: 1 })
  assert.equal(jobs[0].nativeCollectionEvidence.candidateDetails, 3)
  assert.equal(jobs[0].nativeCollectionEvidence.failures.length, 1)
  assert.equal(jobs[0].nativeCollectionEvidence.exclusions[0].reason, 'native-closed')
  assert.equal(jobs.nativeInventory.closingStable, true)
})

test('a trailing error on a detail JSON body cannot produce a published role', async () => {
  const jobs = await run({ pageSize: 2, fetchText: async url => isSearch(url) ? page([row(1), row(2)])
    : detail(Number(new URL(url).searchParams.get('jobSeq'))) + (url.includes('jobSeq=2&') ? 'An unexpected error occurred' : '') })
  assert.deepEqual(jobs.map(job => job.jobId), ['1'])
  assert.equal(jobs.nativeInventory.queryDetailFailureCount, 1)
  assert.equal(jobs.nativeInventory.nativeRoles[1].detailResponseReceived, false)
})

test('foreign employer IDs and a changed closing snapshot reject the JSON batch', async () => {
  await assert.rejects(run({ pageSize: 2, fetchText: async url => isSearch(url) ? page([row(1)])
    : detail(1).replace('"companyMstrSeq":72', '"companyMstrSeq":73').replace('"companySeq":72', '"companySeq":73') }), gap)
  let searches = 0
  await assert.rejects(run({ pageSize: 2, fetchText: async url => isSearch(url)
    ? page([row(++searches === 1 ? 1 : 2)]) : detail(1) }), gap)
})

test('JSON default transport uses the published headers and rejects a non-JSON content type', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return { status: 200, headers: new Headers({ 'content-type': 'application/json' }),
      body: { cancel: async () => {} }, text: async () => isSearch(url) ? page([], 0, 0, 10) : detail(1) }
  }
  try {
    const jobs = await run()
    assert.equal(jobs.length, 0)
    assert.equal(calls.length, 2)
    for (const { options } of calls) {
      assert.match(options.headers.Accept, /application\/json/)
      assert.equal(options.headers['X-Requested-With'], 'XMLHttpRequest')
      assert.equal(options.credentials, 'omit')
      assert.equal(options.redirect, 'error')
    }
    globalThis.fetch = async () => ({ status: 200, headers: new Headers({ 'content-type': 'text/html' }),
      body: { cancel: async () => {} }, text: async () => page([], 0, 0, 10) })
    await assert.rejects(run(), error => gap(error) && /not JSON/.test(error.message))
  } finally { globalThis.fetch = original }
})

test('ignored injected readers and zero source budgets cannot run without bounds', async () => {
  let calls = 0
  await assert.rejects(run({ collectionBudgetMs: 0, fetchText: async () => { calls++; return page([], 0, 0, 10) } }), gap)
  assert.equal(calls, 0)
  const outcome = await Promise.race([run({ requestTimeoutMs: 10, collectionBudgetMs: 100,
    fetchText: async () => new Promise(() => {}) }).then(() => 'resolved', error => error), delay(300, 'unbounded')])
  assert.notEqual(outcome, 'unbounded')
  assert.equal(gap(outcome), true)
})

test('legacy XML selection consumes the first response once and retains native limits and time bounds', async () => {
  const listing = '<jobVoList><jobSeq>1</jobSeq><jobTitle>Engineer</jobTitle><jobLocation>India</jobLocation><locations>Bengaluru</locations></jobVoList>'
  const xmlPage = `<JobPageVO><startJobIndex>0</startJobIndex><maxJobSize>1</maxJobSize><totalJobCount>2</totalJobCount>${listing}</JobPageVO>`
  let calls = 0
  await assert.rejects(run({ pageSize: 1, maxPages: 1, fetchText: async () => { calls++; return xmlPage } }), gap)
  assert.equal(calls, 1)
  calls = 0
  await assert.rejects(run({ pageSize: 1, maxJobs: 1, fetchText: async () => { calls++; return xmlPage } }), gap)
  assert.equal(calls, 1)
  let detailCalls = 0
  const onePage = xmlPage.replace('<totalJobCount>2</totalJobCount>', '<totalJobCount>1</totalJobCount>')
  const outcome = await Promise.race([run({ pageSize: 1, requestTimeoutMs: 10, collectionBudgetMs: 100,
    fetchText: async url => {
      if (isSearch(url)) return onePage
      detailCalls++
      return new Promise(() => {})
    } }).then(() => 'resolved', error => error), delay(300, 'unbounded')])
  assert.notEqual(outcome, 'unbounded')
  assert.equal(gap(outcome), true)
  assert.equal(detailCalls, 1)
})

test('injected legacy XML cannot bypass first-body, later-body or aggregate byte limits', async () => {
  const empty = '<JobPageVO><startJobIndex>0</startJobIndex><maxJobSize>10</maxJobSize><totalJobCount>0</totalJobCount></JobPageVO>'
  const oversized = empty.replace('</JobPageVO>', `<nativeComment>${'é'.repeat(300)}</nativeComment></JobPageVO>`)
  for (const largeFirst of [true, false]) {
    let calls = 0
    await assert.rejects(run({ maxResponseBytes: 400, maxTotalBytes: 2000, fetchText: async () => {
      calls++
      return largeFirst || calls > 1 ? oversized : empty
    } }), error => gap(error) && /byte/i.test(error.message))
    assert.equal(calls, largeFirst ? 1 : 2)
  }
  let calls = 0
  await assert.rejects(run({ maxResponseBytes: 400, maxTotalBytes: Buffer.byteLength(empty) + 1,
    fetchText: async () => { calls++; return empty } }), error => gap(error) && /byte/i.test(error.message))
  assert.equal(calls, 2, 'Cached protocol-selection response must not be charged a second time')
})

test('registered LTIM collector consumes all 675 genuine unchanged bodies and reconciles native outcomes', async () => {
  const observedAt = '2026-11-05T08:43:58.729Z'
  const requests = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/2026-11-05-json-current.json.gz', import.meta.url)))).requests
  const source = buildScrapers().find(scraper => scraper.name === 'ltimindtree')
  assert.ok(source)
  const RealDate = globalThis.Date
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [observedAt])) }
    static now() { return RealDate.parse(observedAt) }
  }
  let index = 0
  try {
    const jobs = await source.run({ pageSize: 100, detailConcurrency: 6, fetchText: async (url, options) => {
      const packet = requests[index++]
      assert.ok(packet, 'No request outside the genuine response set is allowed')
      assert.equal(url, packet.url)
      assert.equal(options.method || 'GET', packet.method)
      assert.equal(options.body?.toString() || null, packet.requestBody)
      assert.deepEqual(options.headers, packet.headers)
      const bytes = Buffer.from(packet.body)
      assert.equal(bytes.length, packet.bytes)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.sha256)
      return packet.body
    } })
    assert.equal(index, 675)
    assert.equal(jobs.length, 473)
    assert.equal(rawMetrics(jobs).rawJobs, 661)
    assert.equal(readInventoryEvidence(jobs).verifiedAt, observedAt, 'Offline replay cannot renew the source clock')
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && !job.lifecycleCleanupAllowed))
    const native = jobs[0].nativeCollectionEvidence
    assert.equal(native.candidateDetails, 661)
    assert.equal(native.jobs.length, 473)
    assert.equal(native.exclusions.length, 187)
    assert.equal(native.failures.length, 1)
    assert.equal(native.failures[0].jobId, '884044')
    assert.equal(native.unresolvedRoles.length, 188, 'This observation count overlaps the failed-detail subset')
    assert.ok(native.unresolvedRoles.every(job => job.country === null))
    assert.equal(native.listingPaginationComplete, true)
    assert.equal(native.closingInventoryMatches, true)
    assert.equal(native.sourceScopeComplete, false)
    const health = extractionDetailHealth(jobs)
    assert.equal(health.nativeCollections[0].countsReconciled, true)
    assert.equal(health.nativeCollections[0].unextractedDetailFailures, 1)
    assert.equal(health.complete, false)
    assert.doesNotThrow(() => JSON.stringify(jobs))
  } finally { globalThis.Date = RealDate }
})
