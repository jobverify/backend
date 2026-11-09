import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createPersistentScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => gunzipSync(readFileSync(new URL(`../../scraper-support/tests/fixtures/persistent/${name}`, import.meta.url))).toString()
const json = name => JSON.parse(fixture(name))
const SEARCH = 'https://public.zwayam.com/jobs/search'
const DETAIL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
const nativeDescription = json('current-detail.json.gz').jobConfigurationData.Description

const replay = ({ beforeRead = () => {}, requestIntervalMs = 0, rowTransform = row => row } = {}) => {
  const requests = []
  const rows = Array.from({ length: 2 }, (_, index) => {
    const row = json('current-search.json.gz').data.data[0]._source
    row.id += index
    row.jobCode = String(Number(row.jobCode) + index)
    row.jobUrl = `budget-role-${index}`
    for (const office of row.jobLocationRecord) office.jobId = row.id
    return rowTransform(row, index)
  })
  const reader = async (url, options = {}) => {
    requests.push(url)
    const interrupted = await beforeRead(url, options, requests)
    if (interrupted !== undefined) return interrupted
    if (url === 'https://www.persistent.com/careers/') return { text: fixture('current-careers.html.gz'), finalUrl: 'https://careers.persistent.com/' }
    if (url.endsWith('/main.be21217dba32513f.js')) return { text: fixture('current-main.js.gz'), finalUrl: url }
    if (url.endsWith('/careersite-configurations')) return json('current-company.json.gz')
    if (url === SEARCH) {
      const payload = json('current-search.json.gz')
      Object.assign(payload.data, { data: rows.map(row => ({ _source: structuredClone(row) })), totalCount: 2, hasMoreData: false })
      payload.data.facetedSearchConfig.paginationHowMuch = '2'
      payload.data.facets.Location = [{ key: 'India', doc_count: 2 }]
      return payload
    }
    if (url === DETAIL) {
      const row = rows.find(row => row.id === JSON.parse(options.body).jobId)
      const detail = json('current-detail.json.gz')
      Object.assign(detail, { id: row.id, jobCode: row.jobCode, jobUrl: row.jobUrl })
      detail.jobConfigurationData['Job Code'] = row.jobCode
      return detail
    }
    if (url.includes('/getReqFieldsForCareersSite/')) return json('current-requisition.json.gz')
    throw Error(`Uncaptured public URL: ${url}`)
  }
  return { requests, scraper: createPersistentScraper({ requestIntervalMs, fetchJsonImpl: reader, fetchTextImpl: reader }) }
}

// The test owns a short fallback so an implementation without a deadline fails
// an assertion instead of leaving the test process waiting on an external read.
const boundedRun = async (scraper, options = {}) => {
  const caller = new AbortController()
  let timer
  try {
    return await Promise.race([
      scraper.run({ ...options, signal: options.signal || caller.signal }).catch(error => error),
      new Promise(resolve => { timer = setTimeout(() => resolve(Error('test fallback reached before source settled')), 700) }),
    ])
  } finally { clearTimeout(timer); caller.abort(Error('test cleanup')) }
}

test('default Persistent deadline keeps complete raw details and leaves unswept roles unresolved', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-07T00:00:00Z') })
  let detailReads = 0
  const { scraper, requests } = replay({ beforeRead: url => {
    if (url === DETAIL && ++detailReads === 2) t.mock.timers.tick(900000)
  } })
  const jobs = await scraper.run()
  assert.equal(jobs.length, 1, 'An expired source must not accept the second role or start closing reads')
  assert.equal(jobs[0].jobDescriptionHtml, nativeDescription)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].sourceEnumerationComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(jobs[0].sourceNativeInventory.collectionBudgetExhausted, true)
  assert.equal(jobs[0].sourceNativeInventory.collectionBudgetMs, 900000)
  assert.equal(jobs[0].sourceNativeInventory.detailBodiesFetched, 1)
  assert.equal(jobs[0].sourceNativeInventory.requisitionBodiesFetched, 1)
  assert.equal(jobs[0].sourceNativeInventory.closingEnumerationComplete, false)
  assert.equal(requests.filter(url => url === SEARCH).length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /native-collection-budget-exhausted/)
})

test('Persistent collection deadline races a supplied reader that never settles and aborts its signal', async () => {
  let transportSignal
  const { scraper, requests } = replay({ beforeRead: (_url, request) => {
    transportSignal = request.signal
    return new Promise(() => {})
  } })
  const jobs = await boundedRun(scraper, { collectionBudgetMs: 40 })
  assert.ok(Array.isArray(jobs), String(jobs))
  assert.equal(jobs.length, 0)
  assert.equal(transportSignal.aborted, true)
  assert.equal(requests.length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /native-collection-budget-exhausted/)
})

test('Persistent deadline includes the existing paced request wait without scheduling a new request', async () => {
  const { scraper, requests } = replay({ requestIntervalMs: 1000 })
  const jobs = await boundedRun(scraper, { collectionBudgetMs: 60 })
  assert.ok(Array.isArray(jobs), String(jobs))
  assert.equal(jobs.length, 0)
  assert.equal(requests.filter(url => url.startsWith('https://public.zwayam.com/')).length, 1)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.match(readInventoryEvidence(jobs).reason, /native-collection-budget-exhausted/)
})

test('Persistent caller cancellation keeps its exact reason when a custom detail reader ignores signals', async () => {
  const caller = new AbortController(), reason = Error('caller stopped this source')
  const { scraper } = replay({ beforeRead: url => {
    if (url === DETAIL) { caller.abort(reason); return new Promise(() => {}) }
  } })
  const result = await boundedRun(scraper, { signal: caller.signal, collectionBudgetMs: 100 })
  assert.equal(result, reason)
})

test('Persistent validates collection bounds before starting any public reads', async () => {
  for (const collectionBudgetMs of [0, -1, 1.5, NaN, Infinity, 900001]) {
    const { scraper, requests } = replay()
    const result = await boundedRun(scraper, { collectionBudgetMs })
    assert.ok(result instanceof TypeError, `Invalid budget ${collectionBudgetMs} must fail validation`)
    assert.equal(requests.length, 0)
  }
})

test('Persistent avoids details already disqualified by contradictory native country authority while still checking closing membership', async () => {
  const { scraper, requests } = replay({ rowTransform: (row, index) => {
    if (index === 1) row.text1 = 'United States'
    return row
  } })
  const jobs = await scraper.run()
  assert.equal(jobs.length, 1)
  assert.equal(requests.filter(url => url === DETAIL).length, 1, 'A detail cannot resolve the listing country contradiction required by the geography gate')
  assert.equal(requests.filter(url => url === SEARCH).length, 2, 'A scope gap must still remove stale roles through closing membership')
  assert.equal(jobs[0].sourceNativeInventory.unknownCountries, 1)
  assert.equal(jobs[0].sourceNativeInventory.detailsUnattempted, 1)
  assert.equal(jobs[0].sourceNativeInventory.detailsSkippedCountryUnresolved, 1)
  assert.equal(jobs[0].sourceNativeInventory.closingStable, true)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})
