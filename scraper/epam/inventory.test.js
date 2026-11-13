import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createEpamScraper, extractSearchResults, run } from './script.js'
import { collectNativeEpam } from './nativeInventory.js'
import { isCompleteScraperAttempt, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'
import { extractionRawJobMetrics } from '../../scraper-support/utils/extractionRawJobMetrics.js'

const fixture = name => gunzipSync(readFileSync(new URL(`./native-captures/${name}`, import.meta.url))).toString()
const originalHTML = fixture('india-careers.html.gz')
const controller = fixture('public-controller.js.gz')
const captured = JSON.parse(fixture('india-first-page.json.gz'))
const clone = value => structuredClone(value)
const batchSymbol = Symbol.for('jobverify.epam-native-inventory')
// These older packets exercise raw collection/projection, not current public
// admission. Registered old-client rejection is covered separately below.
const collectHistorical = options => collectNativeEpam({ options, maxJobs: null,
  headers: { 'User-Agent': 'Mozilla/5.0' },
  project: record => extractSearchResults({ data: { jobs: [record] } })[0],
})
const pageData = html => JSON.parse(html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1])
const htmlFor = rows => {
  const data = pageData(originalHTML)
  for (const key of ['jobs', 'initialJobs']) data.props.pageProps[key] = {
    total: rows.length, jobs: clone(rows).slice(0, 10),
    facets: { country: [{ key: 'India', id: '4060741400035606931', doc_count: rows.length }] },
  }
  return originalHTML.replace(/(<script[^>]+id="__NEXT_DATA__"[^>]*>)[\s\S]*?(<\/script>)/,
    (_, before, after) => before + JSON.stringify(data) + after)
}

// Current complete native GET captures supply all real fields. Fault cases below
// intentionally mutate their scope/content; they are not purported live counts.
function scenario({ rows = captured.data.jobs.slice(0, 3), mutatePage, mutateHTML, mutateResponse } = {}) {
  rows = clone(rows)
  const calls = [], reads = new Map()
  const transport = async (url, init) => {
    calls.push({ url, method: init.method, signal: init.signal, headers: init.headers })
    const count = reads.get(url) || 0
    reads.set(url, count + 1)
    let text, type
    if (url === 'https://careers.epam.com/en/jobs/india') {
      text = mutateHTML?.(htmlFor(rows), count) ?? htmlFor(rows)
      type = 'text/html'
    } else if (new URL(url).pathname.startsWith('/_next/static/chunks/pages/_app-')) {
      text = controller
      type = 'application/javascript'
    } else {
      const u = new URL(url)
      assert.equal(u.pathname, '/api/jobs/v2/search/careers-i18n')
      assert.equal(u.searchParams.get('facets'), 'country=4060741400035606931')
      const offset = Number(u.searchParams.get('from'))
      // Simulates the observed native service cap independently of requested size.
      const payload = { data: { total: rows.length, jobs: clone(rows.slice(offset, offset + 2)),
        facets: { country: [{ key: 'India', id: '4060741400035606931', doc_count: rows.length }] } }, meta: {} }
      mutatePage?.(payload, { offset, read: count })
      text = JSON.stringify(payload)
      type = 'application/json'
    }
    const response = { url, status: 200, headers: { 'content-type': type }, body: Buffer.from(text),
      provenance: 'synthetic-fault-scope-derived-from-unmodified-public-GET-fixtures' }
    return mutateResponse?.(response, count) ?? response
  }
  return { rows, calls, transport, async run(options = {}) {
    return collectHistorical({ transport, ...options })
  } }
}

test('EPAM certifies only reconciled current native pages, using raw row offsets and retaining full bodies', async () => {
  const s = scenario()
  const jobs = await s.run()
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(jobs.length, 3)
  assert.equal(isCompleteScraperAttempt({ success: true, inventoryEvidence: evidence }), true)
  const batch = jobs[batchSymbol]
  assert.deepEqual(batch.passes.map(pass => pass.pages.map(page => page.offset)), [[0, 2], [0, 2]])
  assert.deepEqual(batch.passes.map(pass => pass.rawCount), [3, 3])
  assert.deepEqual(batch.passes.map(pass => pass.uniqueCount), [3, 3])
  assert.equal(batch.closingMatches, true)
  assert.equal(batch.scope, 'current-employer-advertised-native-India-country-feed')
  assert.equal(batch.unknownScopes.includes('unpublished-or-private-requisitions'), true)
  assert.equal(batch.retainedResponses.every(response => response.bodySHA256?.length === 64
    && response.rawBodyBase64 && response.url === response.finalUrl), true)
  assert.match(jobs[0].jobDescription, /10-14 years/)
  assert.match(jobs[0].jobDescription, /Health benefits/)
  assert.match(jobs[0].jobDescription, /leading global provider/)
  assert.deepEqual(jobs[0].nativeRecord, s.rows[0])
  assert.equal(Object.isFrozen(jobs[0].nativeRecord), true)
})

test('EPAM includes India in secondary typed worksites and keeps every declared country', async () => {
  const rows = clone(captured.data.jobs.slice(0, 1))
  rows[0].country.unshift({ id: '8150000000000001018', name: 'Argentina', type: null })
  rows[0].city.unshift({ id: 'native-foreign-city', name: 'Cordoba', country: rows[0].country[0] })
  rows[0].metadata.country.unshift({ id: '8150000000000001018', title: 'Argentina' })
  const jobs = await scenario({ rows }).run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.deepEqual(jobs[0].nativeDeclaredCountries.map(country => country.name), ['Argentina', 'India'])
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('EPAM preserves the native public GET transport headers used by the working API', async () => {
  const s = scenario()
  const jobs = await s.run()
  assert.equal(jobs.length, 3)
  assert.equal(s.calls.every(call => call.method === 'GET' && call.headers['x-anywhere-tenant'] === 'anywhere'
    && call.headers['User-Agent']?.startsWith('Mozilla/5.0')), true)
})

test('EPAM distinguishes the real India page jobs from its unfiltered initialJobs inventory', async () => {
  const jobs = await collectHistorical({ maxPages: 1, transport: async url => ({ url, status: 200,
    headers: { 'content-type': url.endsWith('/india') ? 'text/html' : url.includes('/_next/') ? 'application/javascript' : 'application/json' },
    body: Buffer.from(url.endsWith('/india') ? originalHTML : url.includes('/_next/') ? controller : JSON.stringify(captured)),
  }) })
  assert.equal(jobs.length, 50)
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(jobs[batchSymbol].reportedTotal, 263)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('EPAM refuses metadata that duplicates one country and hides another declared country', async () => {
  const rows = clone(captured.data.jobs.slice(0, 1))
  rows[0].country.push({ id: '8150000000000001018', name: 'Argentina', type: null })
  rows[0].metadata.country = [{ id: '4060741400035606931', title: 'India' }, { id: '4060741400035606931', title: 'India' }]
  const jobs = await scenario({ rows }).run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('EPAM refuses conflicting native tenants reusing the same public role UID and URL', async () => {
  const rows = clone(captured.data.jobs.slice(0, 1))
  const other = clone(rows[0])
  other.tenant = 'anywhere'
  other.unique_id = `anywhere_${other.uid}_en-us`
  rows.push(other)
  const jobs = await scenario({ rows }).run()
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

for (const [name, mutate] of [
  ['changed total', payload => { payload.data.total++ }],
  ['early empty raw page', (payload, { offset }) => { if (offset) payload.data.jobs = [] }],
  ['duplicate native identity', (payload, { offset }) => { if (!offset) payload.data.jobs[1] = clone(payload.data.jobs[0]) }],
  ['closing role content drift', (payload, { read }) => { if (read) payload.data.jobs[0].text += ' Changed role content.' }],
  ['closing identity replacement', (payload, { read }) => { if (read) payload.data.jobs[0].uid = 'different-native-role' }],
  ['invalid envelope', payload => { delete payload.data.jobs }],
  ['unknown secondary country', payload => { payload.data.jobs[0].country.push({ id: 'unknown-id', name: 'Unknown region', type: 'Country' }) }],
  ['country ID contradiction', payload => { payload.data.jobs[0].city[0].country.name = 'Canada' }],
  ['foreign role URL', payload => { payload.data.jobs[0].seo.url = 'https://elsewhere.example/jobs/1' }],
  ['foreign native tenant', payload => { payload.data.jobs[0].tenant = 'someone-else' }],
]) {
  test(`EPAM refuses complete inventory after ${name}`, async () => {
    const jobs = await scenario({ mutatePage: mutate }).run()
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(jobs[batchSymbol].failures.length > 0, true)
    assert.equal(jobs.every(job => job.lifecycleCleanupAllowed === false), true)
  })
}

test('EPAM keeps a missing full native description as a body gap instead of filling it with the summary', async () => {
  const rows = clone(captured.data.jobs.slice(0, 3))
  rows[1].text = null
  const jobs = await scenario({ rows }).run()
  assert.equal(jobs.length, 3)
  assert.equal(jobs[1].jobDescription, null)
  assert.equal(jobs[1].sourceDetailComplete, false)
  assert.equal(jobs[batchSymbol].bodyGaps[0].id, rows[1].unique_id)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('EPAM does not stop pagination when all normalized roles on a raw page are invalid', async () => {
  const rows = clone(captured.data.jobs.slice(0, 3))
  rows[0].name = null
  rows[1].name = null
  const s = scenario({ rows })
  const jobs = await s.run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[batchSymbol].passes[0].uniqueCount, 3)
  assert.equal(s.calls.some(call => new URL(call.url).searchParams.get('from') === '2'), true)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('EPAM retains a failed native HTTP body and its exact digest without certifying inventory', async () => {
  const jobs = await scenario({ mutateResponse: response => response.url.includes('from=2')
    ? { ...response, status: 503, body: Buffer.from('native backend temporarily unavailable') } : response }).run()
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  const failed = jobs[batchSymbol].retainedResponses.find(response => response.status === 503)
  assert.equal(Buffer.from(failed.rawBodyBase64, 'base64').toString(), 'native backend temporarily unavailable')
  assert.equal(failed.bodySHA256, 'c9059bdc2e41ec8a4d098acb9a450427bf0e2f50abad6a2c55a6e410146bf20c')
})

test('EPAM reports explicit job and page limits as incomplete', async () => {
  for (const options of [{ maxJobs: 1 }, { maxPages: 1 }, { maxRequests: 3 }, { maxAggregateBytes: 1000 }]) {
    const jobs = await scenario().run(options)
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
    assert.equal(jobs[batchSymbol].failures.length > 0, true)
  }
})

test('EPAM zero needs affirmative native country evidence and cannot authorize cleanup by an empty query alone', async () => {
  const jobs = await scenario({ rows: [], mutatePage: payload => { payload.data.facets = {} } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'coverage-gap')
  assert.equal(jobs[batchSymbol].cleanupAllowed, false)
})

test('EPAM refuses foreign redirects, changed handoffs and changed public controller code', async () => {
  for (const fault of [
    { mutateResponse: response => ({ ...response, url: 'https://elsewhere.example/jobs' }) },
    { mutateHTML: html => html.replace('"TENANT_NAME":"anywhere"', '"TENANT_NAME":"other"') },
    { mutateResponse: response => response.url.includes('/_next/')
      ? { ...response, body: Buffer.from('changed controller') } : response },
  ]) {
    const jobs = await scenario(fault).run()
    assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  }
})

for (const settles of ['resolve', 'reject', 'never']) {
  test(`EPAM caller abort preserves its opaque exact reason when transport will ${settles}`, async () => {
    const abort = new AbortController(), reason = Object.freeze({ opaque: Symbol('stop') })
    let finish, calls = 0
    const pending = createEpamScraper().run({ signal: abort.signal,
      transport: () => { calls++; return new Promise((resolve, reject) => { finish = settles === 'resolve' ? resolve : reject }) },
      fetchJson: () => new Promise((resolve, reject) => { calls++; finish = settles === 'resolve' ? resolve : reject }),
    })
    await new Promise(resolve => setTimeout(resolve, 5))
    abort.abort(reason)
    if (settles === 'resolve') finish({ data: { total: 0, jobs: [] } })
    if (settles === 'reject') finish(new Error('transport replaced caller reason'))
    await assert.rejects(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('abort was ignored')), 100))]), value => value === reason)
    const before = calls
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(calls, before)
  })
}

test('EPAM request and total deadlines return immutable gaps when transport ignores cancellation', async () => {
  for (const limit of [{ requestTimeoutMs: 5 }, { totalTimeoutMs: 5 }]) {
    let finish, calls = 0
    const jobs = await createEpamScraper().run({ ...limit, transport: () => {
      calls++
      return new Promise(resolve => { finish = resolve })
    } })
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    const before = JSON.stringify(jobs[batchSymbol])
    finish({ url: 'https://careers.epam.com/en/jobs/india', status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(originalHTML) })
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(JSON.stringify(jobs[batchSymbol]), before)
    assert.equal(calls, 1)
    assert.equal(Object.isFrozen(jobs[batchSymbol]), true)
  }
})

test('EPAM public run forwards the caller signal and opaque reason before any I/O', async () => {
  const abort = new AbortController(), reason = Object.freeze({ stop: 'public-run' })
  abort.abort(reason)
  let calls = 0
  await assert.rejects(run({ signal: abort.signal, transport: () => { calls++; throw new Error('unexpected I/O') } }), value => value === reason)
  assert.equal(calls, 0)
})

test('EPAM immediate caller cancellation prevents the deferred public transport operation', async () => {
  for (const reason of [false, null, 0, Object.freeze({ immediateStop: Symbol('opaque') })]) {
    const abort = new AbortController()
    let calls = 0
    const pending = run({ signal: abort.signal, transport: () => { calls++; return new Promise(() => {}) } })
    abort.abort(reason)
    await assert.rejects(pending, value => value === reason)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(calls, 0)
  }
})

test('EPAM cancellation queued by a reader prevents its deferred body read from starting', async () => {
  const abort = new AbortController(), reason = false
  let reads = 0
  const pending = run({ signal: abort.signal, transport: async url => ({ url, status: 200,
    headers: { 'content-type': 'text/html' }, body: { getReader() {
      queueMicrotask(() => abort.abort(reason))
      return { read: () => { reads++; return new Promise(() => {}) }, cancel: async () => {} }
    } },
  }) })
  await assert.rejects(pending, value => value === reason)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(reads, 0)
})

test('registered EPAM withholds old-client publication and preserves complete original observations on the empty array', async () => {
  const provider = buildScrapers().find(scraper => scraper.name === 'epam')
  const s = scenario()
  const jobs = await provider.run({ transport: s.transport })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.complete, true, 'Historical configured collection completeness cannot establish current public admission')
  assert.equal(audit.sourceCurrentAdmissionQualified, false)
  assert.equal(audit.retainedResponses.length, 7)
  assert.equal(audit.passes[0].uniqueCount, 3)
  assert.equal(audit.observations.length, 3)
  assert.deepEqual(audit.observations, s.rows)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.extractedDetailJobs, 0)
  assert.equal(Object.isFrozen(audit), true)
  assert.deepEqual(extractionRawJobMetrics(provider.provider, jobs, null), { rawJobs: 3, rawJobsBasis: 'observed-native-vacancy-rows' })
})

test('runner native counters retain real partial observations and cannot certify malformed geography or missing content', async () => {
  for (const mode of ['country', 'content', 'limit']) {
    const rows = clone(captured.data.jobs.slice(0, 3))
    if (mode === 'country') rows[0].country[0].name = 'Unknown country'
    if (mode === 'content') rows[0].text = null
    const jobs = await scenario({ rows }).run(mode === 'limit' ? { maxJobs: 1 } : {})
    const batch = jobs[0].nativeCollectionEvidence
    const health = extractionDetailHealth(jobs)
    assert.equal(health.complete, false)
    assert.equal(health.nativeCollections[0].sourceMatches, true)
    assert.equal(health.nativeCollections[0].complete, false)
    assert.equal(batch.extractedDetailJobs, jobs.length)
    assert.equal(batch.excludedDetailJobs, 0)
    assert.equal(batch.sourceScopeComplete, false)
    assert.equal(batch.observedListingCount, mode === 'limit' ? 2 : 3)
    assert.deepEqual(extractionRawJobMetrics({ source: 'epam' }, jobs, null), {
      rawJobs: mode === 'limit' ? 2 : 3, rawJobsBasis: 'observed-native-listing-rows',
    })
  }
})

test('EPAM caller cancellation retains completed original observations on the exact Error reason', async () => {
  const s = scenario(), controller = new AbortController(), reason = new Error('stop after original opening observations')
  let firstPageReads = 0, finishLate
  const pending = run({ signal: controller.signal, transport: (url, init) => {
    if (url.includes('/api/jobs/') && new URL(url).searchParams.get('from') === '0' && ++firstPageReads === 2) {
      const stalled = new Promise(resolve => { finishLate = resolve })
      queueMicrotask(() => controller.abort(reason))
      return stalled
    }
    return s.transport(url, init)
  } })
  await assert.rejects(pending, error => error === reason)
  const audit = reason.sourceAudit
  assert.equal(audit.complete, false)
  assert.equal(audit.aborted, true)
  assert.equal(audit.sourceCurrentAdmissionQualified, false)
  assert.deepEqual(audit.observations, s.rows)
  assert.equal(audit.passes[0].rawCount, 3)
  assert.equal(audit.retainedResponses.length, 4)
  assert.equal(Object.isFrozen(audit), true)
  const before = JSON.stringify(audit)
  finishLate({ url: 'https://careers.epam.com/api/jobs/v2/search/careers-i18n', status: 200,
    headers: { 'content-type': 'application/json' }, body: Buffer.from('{}') })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(JSON.stringify(audit), before)
})

test('EPAM audit callbacks stay inside the original total deadline and cannot mutate retained evidence', async () => {
  let called = 0, snapshot
  const startedAt = Date.now()
  const jobs = await scenario().run({ totalTimeoutMs: 500, onAudit: audit => {
    called++
    snapshot = audit
    assert.equal(Object.isFrozen(audit.observations), true)
    return new Promise(() => {})
  } })
  assert.equal(called, 1)
  assert.equal(jobs[batchSymbol].complete, false)
  assert.equal(jobs[batchSymbol].failures.some(row => row.stage === 'audit-callback' && row.code === 'total-timeout'), true)
  assert.equal(jobs[batchSymbol].observations.length, 3)
  assert.equal(snapshot.failures.length, 0, 'Callback snapshot must be independent of later deadline diagnostics')
  assert.ok(Date.now() - startedAt < 2000, 'A stalled audit callback must not outlive the source budget')
})

for (const settles of ['resolve', 'reject', 'never']) {
  test(`EPAM caller abort wins when a body reader will ${settles}`, async () => {
    const abort = new AbortController(), reason = Object.freeze({ bodyStop: Symbol('opaque') })
    let finish, reads = 0, calls = 0
    const pending = createEpamScraper().run({ signal: abort.signal, transport: async url => {
      calls++
      return { url, status: 200, headers: { 'content-type': 'text/html' }, body: { getReader: () => ({
        read: () => { reads++; return new Promise((resolve, reject) => { finish = settles === 'resolve' ? resolve : reject }) },
        cancel: () => Promise.reject(new Error('reader cancellation rejected')),
      }) } }
    } })
    await new Promise(resolve => setTimeout(resolve, 5))
    abort.abort(reason)
    if (settles === 'resolve') finish({ done: false, value: Buffer.from(originalHTML) })
    if (settles === 'reject') finish(new Error('body reader replaced caller reason'))
    await assert.rejects(Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error('body abort ignored')), 100))]), value => value === reason)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(calls, 1)
    assert.equal(reads, 1)
  })
}
