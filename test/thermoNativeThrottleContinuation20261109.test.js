import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { extractPhAppDdo } from '../scraper-support/phenom/engine.js'
import { createNativeDetailRecovery } from '../scraper-support/utils/nativeDetailRecovery.js'
import { createThermoFisherFetchText } from '../scraper/thermofisherscientific/nativeDetailTransport.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/thermofisherscientific/nativeEvidence/native-ws-throttle-20261109.json.gz', import.meta.url))))
for (const row of fixture.cases) for (const packet of [row.limited, row.success]) {
  assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
}
const registered = createCatalogScraper(getScraperCatalog().find(row => row.source === 'thermofisherscientific'))
const replay = async (t, sample, { responses = [sample.limited, sample.success], sleep, options = {} } = {}) => {
  const requests = [], waits = []
  const page = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { totalHits: 1, hits: 1,
    data: { jobs: [sample.listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url) === 'https://jobs.thermofisher.com/global/en/search-results') return new Response(page)
    assert.equal(String(url), sample.limited.url)
    assert.equal(init.method ?? 'GET', 'GET')
    requests.push(String(url))
    const packet = responses[Math.min(requests.length - 1, responses.length - 1)]
    const response = new Response(packet.body, { status: packet.status, headers: { 'content-type': 'text/html', ...packet.headers } })
    Object.defineProperty(response, 'url', { value: Object.hasOwn(packet, 'finalUrl') ? packet.finalUrl : sample.limited.url })
    return response
  })
  const jobs = await registered.run({ useWidgetApi: false, nativeDetailRecovery: false, detailEnrichmentBudgetMs: 5000,
    nativeThrottleSleep: async (ms, context) => { waits.push(ms); if (sleep) await sleep(ms, context) }, ...options })
  return { jobs, requests, waits, evidence: readInventoryEvidence(jobs) }
}

for (const sample of fixture.cases) test('registered Thermo retries only the retained native WS429/HTTP410 for ' + sample.listing.jobId, async t => {
  const { jobs: [job], requests, waits, evidence } = await replay(t, sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, sample.listing.jobId)
  assert.equal(job.sourceUrl, sample.limited.url)
  assert.equal(job.country, 'India')
  assert.ok(job.jobDescription.length > 500)
  assert.deepEqual(requests, [sample.limited.url, sample.limited.url])
  assert.deepEqual(waits, [30000])
  assert.equal(evidence.listingComplete, true)
})

const sample = fixture.cases[0]
const nativeError = value => '<script>phApp.ddo = ' + JSON.stringify({ jobDetail: value }) + '</script>'
for (const [name, packet] of [
  ['a genuine HTTP410', { status: 410, body: nativeError({ status: 404, error: 'Job not found' }) }],
  ['HTTP404 despite a WS429 model', { ...sample.limited, status: 404 }],
  ['HTTP403 despite a WS429 model', { ...sample.limited, status: 403 }],
  ['an empty HTTP410', { status: 410, body: '' }],
  ['a WS429 alongside supplied job data', { status: 410, body: nativeError({ status: 429, error: 'Error in WS call', data: { job: sample.success.model } }) }],
  ['another native error', { status: 410, body: nativeError({ status: 429, error: 'Other error' }) }],
  ['a string native status', { status: 410, body: nativeError({ status: '429', error: 'Error in WS call' }) }],
  ['a missing observed URL', { ...sample.limited, finalUrl: '' }],
  ['plain-text MIME despite the native WS429', { ...sample.limited, headers: { 'content-type': 'text/plain' } }],
  ['JSON MIME despite the native WS429', { ...sample.limited, headers: { 'content-type': 'application/json' } }],
  ['an oversized UTF-8 native error body', { status: 410, body: nativeError({ status: 429, error: 'Error in WS call' }) + '\u00e9'.repeat(300000) }],
  ['a foreign final URL', { ...sample.limited, finalUrl: 'https://foreign.example/job/foreign' }],
  ['an empty HTTP200', { status: 200, body: '' }],
]) test('Thermo conditional throttle handling retains the hold for ' + name, async t => {
  const { jobs: [job], requests, waits } = await replay(t, sample, { responses: [packet, sample.success] })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
  assert.equal(requests.length, 1)
  assert.deepEqual(waits, [])
})

test('an ordinary HTTP429 retains the shared fetch policy and does not acquire native-410 authority', async () => {
  let reads = 0
  const waits = []
  const getPage = createThermoFisherFetchText({ config: { retryAttempts: 1 }, sleep: async ms => waits.push(ms),
    fetchImpl: async () => { reads++; return new Response(sample.limited.body, { status: 429 }) } })
  await assert.rejects(getPage(sample.limited.url), /HTTP 429/)
  assert.equal(reads, 1)
  assert.deepEqual(waits, [])
})

test('Thermo native throttle retries are capped at three same-role requests and sixty seconds', async t => {
  const { jobs: [job], requests, waits } = await replay(t, sample, { responses: [sample.limited] })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'upstream')
  assert.equal(requests.length, 3)
  assert.deepEqual(waits, [30000, 30000])
})

test('a genuine HTTP410 after a native throttle never receives another native retry', async t => {
  const { jobs: [job], requests, waits } = await replay(t, sample, { responses: [sample.limited,
    { status: 410, body: nativeError({ status: 404, error: 'Job not found' }) }, sample.success] })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(requests.length, 2)
  assert.deepEqual(waits, [30000])
})

for (const [seconds, expectedWaits, expectedReads] of [[45, [45000], 2], [61, [], 1]]) {
  test('Thermo respects native Retry-After ' + seconds + ' seconds within the finite wait cap', async t => {
    const { jobs: [job], waits, requests } = await replay(t, sample, { responses: [{ ...sample.limited,
      headers: { 'retry-after': String(seconds) } }, sample.success] })
    assert.deepEqual(waits, expectedWaits)
    assert.equal(requests.length, expectedReads)
    assert.equal(job.sourceDetailComplete, expectedReads === 2)
  })
}

test('Thermo caller cancellation interrupts a native backoff without another request', async t => {
  const controller = new AbortController(), reason = { caller: 'opaque native throttle cancellation' }
  await assert.rejects(replay(t, sample, { options: { signal: controller.signal }, sleep: async (ms, { signal }) => {
    controller.abort(reason)
    signal.throwIfAborted()
  } }), error => error === reason)
})

test('the existing finite Thermo detail budget interrupts native backoff and retains incomplete content', async t => {
  const { jobs: [job], requests } = await replay(t, sample, { options: { detailEnrichmentBudgetMs: 80 },
    sleep: async (ms, { signal }) => new Promise((resolve, reject) => {
      if (signal.aborted) reject(signal.reason)
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }) })
  assert.equal(requests.length, 1)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'budget-exhausted')
  assert.equal(job.jobDescription, null)
})

for (const [name, mutate] of [
  ['foreign native role', model => { model.jobId = 'foreign-role' }],
  ['foreign native sequence', model => { model.jobSeqNo = 'foreign-sequence' }],
  ['conflicting native title', model => { model.title = 'Another role' }],
  ['conflicting native country', model => { model.country = 'US' }],
  ['an absent authored body', model => { model.ml_Description = '' }],
]) test('a successful Thermo throttle retry still rejects ' + name, async t => {
  const model = structuredClone(extractPhAppDdo(sample.success.body).jobDetail.data.job)
  mutate(model)
  const body = '<link rel="canonical" href="' + sample.limited.url + '">' + nativeError({ data: { job: model } })
  const { jobs: [job], requests, waits } = await replay(t, sample, { responses: [sample.limited, { status: 200, body }] })
  assert.equal(requests.length, 2)
  assert.deepEqual(waits, [30000])
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

test('an unchanged verified Thermo recovery receipt needs no further detail retry', async t => {
  const recovery = createNativeDetailRecovery()
  assert.equal((await replay(t, sample, { options: { nativeDetailRecovery: recovery } })).jobs[0].sourceDetailComplete, true)
  const { jobs: [job], requests, waits } = await replay(t, sample, { options: { nativeDetailRecovery: recovery } })
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceDetailFromRecovery, true)
  assert.equal(requests.length, 0)
  assert.deepEqual(waits, [])
})
