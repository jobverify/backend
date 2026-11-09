import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { CAREERS_URL, API_URL } from './nativeCollector.js'
import { readInventoryEvidence, isCompleteScraperAttempt, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

// Protocol tests compose the retained opening responses into an unchanged
// closing response. They are not a second live observation or a fresh capture.
const { packets: [careers, api] } = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-careers-20261031.json.gz', import.meta.url))))
const original = JSON.parse(api.body)
const captureClock = api.capturedAt
const indiaPayload = () => {
  const payload = structuredClone(original)
  payload.jobs[0].location = 'Bengaluru, India'
  payload.jobs[0].address = { postalAddress: { addressCountry: 'India', addressLocality: 'Bengaluru' } }
  return payload
}
const collect = async ({ payload = structuredClone(original), openingHTML = careers.body,
  closingHTML = openingHTML, closingPayload = structuredClone(payload), closingError,
  closingPageError, signal = new AbortController().signal, beforeRead = () => {}, now = () => captureClock } = {}) => {
  const calls = [], page = html => ({ status: 200, url: CAREERS_URL, html })
  let pageReads = 0, apiReads = 0
  const jobs = await run({ signal, now,
    fetchPage: async (url, options) => {
      assert.equal(url, CAREERS_URL)
      assert.ok(options.signal instanceof AbortSignal)
      calls.push(url); beforeRead(calls.length, options.signal)
      if (++pageReads > 1 && closingPageError) throw closingPageError
      return page(pageReads === 1 ? openingHTML : closingHTML)
    },
    fetchJson: async (url, options) => {
      assert.equal(url, API_URL)
      assert.ok(options.signal instanceof AbortSignal)
      calls.push(url); beforeRead(calls.length, options.signal)
      if (++apiReads > 1 && closingError) throw closingError
      return apiReads === 1 ? payload : closingPayload
    },
  })
  return { jobs, calls, evidence: readInventoryEvidence(jobs) }
}
const assertPartial = ({ jobs, evidence }, expectedIndia = 1) => {
  assert.equal(jobs.length, expectedIndia)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, null)
  for (const job of jobs) {
    assert.equal(job.sourceListingComplete, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
}

test('current employer-bound complete native countries plus independent closing qualify the public inventory', async () => {
  const { jobs, calls, evidence } = await collect()
  assert.deepEqual(calls, [CAREERS_URL, API_URL, API_URL, CAREERS_URL])
  assert.equal(jobs.length, 0)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.reportedTotal, null, 'nine observed rows are not a publisher-reported total')
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.verifiedAt, captureClock)
  assert.equal(evidence.pagesFetched, 4)
  assert.equal(readSourceObservationEvidence(jobs, 'aplazo').observedRecordCount, original.jobs.length)
  assert.equal(isCompleteScraperAttempt({ success: true, inventoryEvidence: evidence,
    detailHealth: extractionDetailHealth(jobs), completedAt: captureClock }), true)
  assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: new Date(+new Date(captureClock) + 49 * 3600000) }), false)
})

test('a future typed India role keeps its original full content, publication date, URLs and native record', async () => {
  const payload = indiaPayload(), { jobs, evidence } = await collect({ payload })
  assert.equal(jobs.length, 1)
  const [job] = jobs, native = payload.jobs[0]
  assert.equal(job.sourceDescription, native.descriptionHtml)
  assert.equal(job.jobDescription, native.descriptionHtml)
  assert.equal(job.postingDate, native.publishedAt)
  assert.equal(job.sourceUrl, native.jobUrl)
  assert.equal(job.applyUrl, native.applyUrl)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceListingComplete, true)
  assert.equal(job.sourceScopeComplete, true)
  assert.equal(job.lifecycleCleanupAllowed, true)
  assert.deepEqual(job.nativeSourceRecord, native)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

test('only an actually empty complete board may be verified-empty', async () => {
  const { jobs, evidence } = await collect({ payload: { apiVersion: '1', jobs: [] } })
  assert.equal(jobs.length, 0)
  assert.equal(evidence.status, 'verified-empty')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, 0)
})

test('native record order is not a closing inventory change', async () => {
  const payload = indiaPayload(), closingPayload = structuredClone(payload)
  closingPayload.jobs.reverse()
  const { evidence } = await collect({ payload, closingPayload })
  assert.equal(evidence.listingComplete, true)
})

for (const [label, alter] of [
  ['new role', p => { const row = structuredClone(p.jobs[1]); row.id = 'controlled-new-role'; row.jobUrl = `https://jobs.ashbyhq.com/aplazo/${row.id}`; row.applyUrl = row.jobUrl + '/application'; p.jobs.push(row) }],
  ['full description changed', p => { p.jobs[0].descriptionHtml += '<p>Controlled changed role criteria.</p>' }],
  ['publication changed', p => { p.jobs[0].publishedAt = '2026-11-01T00:00:00.000Z' }],
  ['country changed', p => { p.jobs[0].location = 'Mexico'; p.jobs[0].address = { postalAddress: { addressCountry: 'Mexico' } } }],
  ['native error envelope', p => { p.success = false }],
  ['new pagination', p => { p.hasMore = true }],
]) test('closing ' + label + ' retains opening India positives with incomplete coverage', async () => {
  const payload = indiaPayload(), closingPayload = structuredClone(payload)
  alter(closingPayload)
  const result = await collect({ payload, closingPayload })
  assertPartial(result)
  assert.equal(result.jobs[0].sourceDescription, payload.jobs[0].descriptionHtml)
  assert.equal(result.jobs[0].postingDate, payload.jobs[0].publishedAt)
})

for (const [key, value] of [['nextCursor', 'controlled-next'], ['links', { next: '/next' }], ['total', 99]]) {
  test('unreviewed native envelope ' + key + ' cannot certify a complete public board', async () => {
    const payload = indiaPayload(); payload[key] = value
    assertPartial(await collect({ payload }))
  })
}

test('a foreign row with an unresolved secondary country prevents authoritative zero India', async () => {
  const payload = structuredClone(original)
  payload.jobs[1].secondaryLocations = [{ location: 'Remote', address: {} }]
  assertPartial(await collect({ payload }), 0)
})

test('native foreign roles do not need a full India detail description to prove country exclusion', async () => {
  const payload = structuredClone(original)
  payload.jobs[1].descriptionHtml = '<p>TBD</p>'; payload.jobs[1].descriptionPlain = 'TBD'
  const { evidence } = await collect({ payload })
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.indiaFacetCount, 0)
})

for (const stage of ['opening', 'closing']) test('an additional employer ATS on the ' + stage + ' page preserves positives but limits inventory', async () => {
  const extra = '<a href="https://jobs.ashbyhq.com/another-employer">Search jobs</a>'
  const html = careers.body.replace('</body>', extra + '</body>')
  assert.notEqual(html, careers.body)
  assertPartial(await collect({ payload: indiaPayload(), ...(stage === 'opening' ? { openingHTML: html } : { closingHTML: html }) }))
})

for (const [label, extra] of [
  ['custom careers host', '<a href="https://careers.aplazo.mx/roles">Open positions</a>'],
  ['inline child document', '<iframe srcdoc="&lt;a href=&quot;https://jobs.lever.co/aplazo&quot;&gt;Corporate job openings&lt;/a&gt;"></iframe>'],
  ['object child document', '<object data="https://careers.aplazo.mx/roles"></object>'],
  ['native recruiting form', '<form action="https://jobs.lever.co/aplazo"><button>Open positions</button></form>'],
  ['submitter recruiting action', '<button formaction="https://careers.aplazo.mx/roles">Search jobs</button>'],
  ['attributed script closing boundary', '<script></script data-review><a href="https://careers.aplazo.mx/roles">Open positions</a><script></script>'],
  ['alternate comment closing boundary', '<!-- controlled--!><a href="https://careers.aplazo.mx/roles">Open positions</a><!-- -->'],
  ['abrupt empty comment boundary', '<!--><a href="https://careers.aplazo.mx/jobs">Open positions</a><!-- -->'],
  ['abrupt dash comment boundary', '<!---><a href="https://careers.aplazo.mx/jobs">Open positions</a><!-- -->'],
  ['accessible image recruiting link', '<a href="https://external.example/next"><img alt="Open positions"></a>'],
  ['entity-encoded careers link', '<a href="https&colon;//careers.aplazo.mx/roles">Go</a>'],
  ['scripted recruiting control', '<div role="button" onclick="location.href=\'https://careers.aplazo.mx/roles\'">Open positions</div>'],
  ['hidden referenced accessible recruiting name', '<span id="scope-reference" hidden>Open positions</span><a href="https://external.example/search" aria-labelledby="scope-reference">Learn more</a>'],
]) test('additional visible ' + label + ' cannot disappear from public source scope', async () => {
  const closingHTML = careers.body.replace('</body>', extra + '</body>')
  assert.notEqual(closingHTML, careers.body)
  assertPartial(await collect({ payload: indiaPayload(), closingHTML }))
})

for (const [label, gap] of [['NBSP', '\u00a0'], ['vertical tab', '\u000b']]) {
  test(label + ' cannot supply HTML whitespace before a required native handoff attribute', async () => {
    const openingHTML = careers.body.replaceAll('href="https://jobs.ashbyhq.com/aplazo"', gap + 'href="https://jobs.ashbyhq.com/aplazo"')
    assert.notEqual(openingHTML, careers.body)
    await assert.rejects(collect({ openingHTML }), /employer|HTML/i)
  })
}

for (const [label, alter] of [
  ['native component model changed', html => html.replace('"comp-mkg43zpd":"TPA3DCarousel"', '"comp-mkg43zpd":"ControlledJobList"')],
  ['product section purpose changed', html => html.replace('Nuestros productos combinan', 'Nuestras posiciones combinan')],
  ['product copy advertises current carousel vacancies', html => html.replace('Nuestros productos combinan', 'Nuestros productos combinan. Encuentra nuestras vacantes actuales en el carrusel. Nuestros productos combinan')],
  ['frame moved outside the reviewed products section', html => html.replaceAll('id="comp-mhmjzecr"', 'id="controlled-new-section"')],
  ['srcdoc overrides a known lazy carousel', html => html.replace('<iframe class="XEILsR"', '<iframe srcdoc="&lt;p&gt;Controlled job openings&lt;/p&gt;" class="XEILsR"')],
]) test('known product carousel exclusion is withdrawn when ' + label, async () => {
  const closingHTML = alter(careers.body)
  assert.notEqual(closingHTML, careers.body)
  assertPartial(await collect({ payload: indiaPayload(), closingHTML }))
})

test('a changed closing first-party employer binding preserves previously validated India roles', async () => {
  const closingHTML = careers.body.replaceAll('https://jobs.ashbyhq.com/aplazo', 'https://jobs.ashbyhq.com/changed')
  assertPartial(await collect({ payload: indiaPayload(), closingHTML }))
})

for (const field of ['closingError', 'closingPageError']) test(field + ' is an optional completeness failure, retaining full India content', async () => {
  const result = await collect({ payload: indiaPayload(), [field]: Object.assign(new Error('controlled optional closing HTTP403'), { status: 403 }) })
  assertPartial(result)
  assert.ok(result.jobs[0].sourceDescription.length > 1000)
})

test('incomplete India detail retains original content and prevents complete inventory', async () => {
  const payload = indiaPayload(); payload.jobs[0].descriptionHtml = '<p>TBD</p>'; payload.jobs[0].descriptionPlain = 'TBD'
  const result = await collect({ payload })
  assertPartial(result)
  assert.equal(result.jobs[0].sourceDescription, '<p>TBD</p>')
  assert.equal(result.jobs[0].sourceDetailComplete, false)
  assert.equal(extractionDetailHealth(result.jobs).complete, false)
})

for (const at of [3, 4]) test('caller cancellation on closing read ' + at + ' propagates its exact reason', async () => {
  const controller = new AbortController(), reason = Object.freeze({ kind: 'controlled closing caller cancellation', at })
  await assert.rejects(collect({ payload: indiaPayload(), signal: controller.signal,
    beforeRead: count => { if (count === at) controller.abort(reason) } }), error => error === reason)
})

test('an invalid offline proof clock cannot create fresh complete evidence', async () => {
  assertPartial(await collect({ payload: indiaPayload(), now: () => 'invalid clock' }))
})

const response = (body, url, options = {}) => {
  const result = new Response(body, { status: 200, headers: { 'Content-Type': url === API_URL ? 'application/json' : 'text/html' }, ...options })
  Object.defineProperty(result, 'url', { value: url })
  return result
}

test('the actual four-response registered cohort replays byte-exact with its original clock', async t => {
  const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/registered-public-20261101.json.gz', import.meta.url))))
  assert.equal(capture.kind, 'actual-default-registered-source-HTTP-capture')
  const pending = [...capture.packets]
  t.mock.method(globalThis, 'fetch', async url => {
    const packet = pending.shift()
    assert.ok(packet); assert.equal(String(url), packet.url)
    const body = Buffer.from(packet.rawBodyBase64, 'base64')
    assert.equal(body.length, packet.bodyBytes)
    assert.equal(createHash('sha256').update(body).digest('hex'), packet.bodySHA256)
    assert.equal(packet.status, 200)
    return response(body, packet.finalUrl, { headers: packet.headers, status: packet.status })
  })
  const jobs = await run({ now: () => capture.completedAt })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(pending.length, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.verifiedAt, capture.completedAt)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(readSourceObservationEvidence(jobs, 'aplazo').observedRecordCount, 9)
})

test('default transport requires native JSON and stops without a follow-up read', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url)
    assert.equal(options.redirect, 'manual'); assert.equal(options.credentials, 'omit')
    return url === CAREERS_URL ? response(careers.body, url)
      : response(api.body, url, { headers: { 'Content-Type': 'text/html' } })
  })
  await assert.rejects(run(), /not JSON/)
  assert.deepEqual(calls, [CAREERS_URL, API_URL])
})

test('declared oversized opening content is rejected before its body is read', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async url => {
    calls++
    return response('controlled body', url, { headers: { 'Content-Type': 'text/html', 'Content-Length': '3000001' } })
  })
  await assert.rejects(run(), /source budget/)
  assert.equal(calls, 1)
})

test('actual streamed body limit cancels the reader before accepting an oversized employer page', async t => {
  let cancelled = false, chunks = 0, calls = 0
  t.mock.method(globalThis, 'fetch', async url => {
    calls++
    const stream = new ReadableStream({ pull(controller) { chunks++; controller.enqueue(new Uint8Array(800000)) }, cancel() { cancelled = true } })
    return response(stream, url)
  })
  await assert.rejects(run(), /source budget/)
  assert.equal(calls, 1); assert.equal(cancelled, true); assert.ok(chunks <= 5)
})

test('an oversized optional closing response retains the full opening native India role', async t => {
  const payload = indiaPayload(), calls = []
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url)
    if (calls.length === 4) return response('controlled oversized closing', url, { headers: { 'Content-Length': '3000001' } })
    return response(url === API_URL ? JSON.stringify(payload) : careers.body, url)
  })
  const jobs = await run({ now: () => captureClock })
  assertPartial({ jobs, evidence: readInventoryEvidence(jobs) })
  assert.equal(jobs[0].sourceDescription, payload.jobs[0].descriptionHtml)
  assert.equal(calls.length, 4)
})

test('a native access denial is not retried or followed through another client', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(url)
    return url === CAREERS_URL ? response(careers.body, url) : response('Denied', url, { status: 403 })
  })
  await assert.rejects(run(), error => error.failureKind === 'blocked_or_access_denied')
  assert.deepEqual(calls, [CAREERS_URL, API_URL])
})
