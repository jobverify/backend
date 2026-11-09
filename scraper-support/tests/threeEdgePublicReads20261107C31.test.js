import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {setTimeout as schedule, clearTimeout as unschedule, setImmediate as immediate} from 'node:timers'
import test from 'node:test'
import * as threeEdge from '../../scraper/3edge/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {getScraperCatalog, createCatalogScraper} from '../providers/index.js'

// The only positive HTTP entity is the unchanged saved 200 homepage. Changed
// documents and transports below are explicitly synthetic control boundaries.
const folder = new globalThis.URL('./fixtures/threeEdgePublicReads20261107C31/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new globalThis.URL('manifest.json', folder)))
const receipt = manifest.records[0]
const body = gunzipSync(fs.readFileSync(new globalThis.URL('0001.body.gz', folder)))
const html = body.toString('utf8')
const URL = 'https://3edge.com/'
const SHA = '163f78d3cf96f12c93d161bb48560376d61e1b8e24777bda73b11a0843e8002d'
const now = () => '2026-11-07T01:00:00.000Z'
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => {resolve = a; reject = b}); return {promise, resolve, reject} }
const tick = () => new Promise(resolve => immediate(resolve))
const never = () => new Promise(() => {})
const original = () => ({url: receipt.finalUrl, requestedUrl: receipt.requestedUrl, status: receipt.status,
  headers: structuredClone(receipt.headers), bodyBase64: body.toString('base64'),
  sourceRequestedAt: receipt.sourceRequestedAt, sourceCompletedAt: receipt.sourceCompletedAt,
  sourceHttpDate: receipt.sourceHttpDate, originalReceipt: structuredClone(receipt),
  provenance: {transport: manifest.transport, bodyFile: receipt.bodyFile, redirectsFollowed: false,
    corporateJavaScriptExecuted: false, subresourcesRequested: false}})
const changed = content => ({url: URL, status: 200, headers: {'content-type': 'text/html; charset=utf-8'},
  bodyBase64: Buffer.from(content).toString('base64'), syntheticBoundaryEntity: true,
  sourceRequestedAt: '2026-11-07T00:00:00.000Z', sourceCompletedAt: '2026-11-07T00:00:00.001Z'})
const document = content => '<html><head><title>3Edge Technologies: When it comes down to IT</title></head><body>' + content + '</body></html>'
const replay = (mutate = page => page) => {
  const requests = [], audits = [], metadata = [], records = []
  return {requests, audits, metadata, records, options: {now,
    fetchPage: async (url, init) => {requests.push({url, ...init}); return mutate(original())},
    onAudit: value => audits.push(value), onMetadata: value => metadata.push(value), onRecords: value => records.push(value)}}
}
const guarded = async pending => {
  let timer
  try {return await Promise.race([pending, new Promise((_, reject) => {timer = schedule(() => reject(Error('Test watchdog: public operation did not settle')), 600)})])}
  finally {unschedule(timer)}
}
const rejection = async (pending, inspect) => {
  let rejected = false, reason
  try {await guarded(pending)} catch (error) {rejected = true; reason = error}
  assert.equal(rejected, true, 'The public operation must reject')
  inspect(reason)
}
const deadline = kind => error => {
  assert.equal(error?.failureKind, 'network_or_timeout')
  assert.match(error.message, new RegExp(kind + '.*deadline', 'i'))
  assert.equal(error.lifecycleCleanupAllowed, false)
}
const gap = jobs => {
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, null)
  const observed = readSourceObservationEvidence(jobs, '3edge')
  assert.equal(observed?.sourceScopeComplete, false)
  assert.equal(observed.companyGlobalTotal, null)
  assert.equal(observed.companyIndiaTotal, null)
  assert.equal(jobs.nativeEvidence.lifecycleCleanupAllowed, false)
  assert.equal(jobs.nativeEvidence.nativeReportedTotal, null)
  assert.equal(jobs.nativeEvidence.companyGlobalTotal, null)
  assert.equal(jobs.nativeEvidence.companyIndiaTotal, null)
}
const nativeResponse = reader => ({status: 200, url: URL, headers: new Headers({'content-type': 'text/html'}), body: {getReader: () => reader}})
const finiteReader = (bytes = new Uint8Array(body), beforeRead = () => {}) => {
  let done = false
  return {read() {if (done) return Promise.resolve({done: true}); done = true; beforeRead(); return Promise.resolve({done: false, value: bytes})},
    cancel() {return Promise.resolve()}, releaseLock() {}}
}

test('saved homepage retains genuine bytes, original URL/status and original acquisition clocks', () => {
  assert.equal(body.length, 8666)
  assert.equal(createHash('sha256').update(body).digest('hex'), SHA)
  assert.equal(receipt.requestedUrl, URL)
  assert.equal(receipt.status, 200)
  assert.equal(receipt.sourceRequestedAt, '2026-11-06T21:00:04.250Z')
  assert.equal(receipt.sourceCompletedAt, '2026-11-06T21:00:15.345Z')
})

test('public wrapper forwards original-response and audit options, retaining unknown inventory scope', async () => {
  const r = replay()
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.deepEqual(r.requests.map(row => row.url), [URL])
  assert.equal(r.requests[0].method, 'GET')
  assert.equal(r.requests[0].redirect, 'manual')
  assert.equal(r.requests[0].credentials, 'omit')
  assert.equal(r.audits.length, 1)
  assert.equal(r.metadata.length, 1)
  assert.deepEqual(r.records, [[]])
  const audit = r.audits[0]
  assert.equal(audit.source, '3edge')
  assert.equal(audit.responses[0].bodyBase64, body.toString('base64'))
  assert.equal(audit.responses[0].sha256, SHA)
  assert.equal(audit.responses[0].bytes, 8666)
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-06T21:00:04.250Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-06T21:00:15.345Z')
  assert.deepEqual(audit.rawPages[0].originalReceipt, receipt)
  assert.deepEqual(audit.rawPages[0].provenance, original().provenance)
  assert.equal(audit.responses[0].sourceHttpDate, 'Fri, 06 Nov 2026 21:00:38 GMT')
  assert.deepEqual(audit.observations, [])
  assert.equal(r.metadata[0].verifiedAt, null)
  assert.equal(r.metadata[0].runtimeInventoryVerification, false)
  assert.equal(r.metadata[0].lifecycleCleanupAllowed, false)
})

test('decoded-only compatibility reads the homepage once and remains unqualified', async () => {
  const requests = [], audits = []
  const jobs = await threeEdge.create3EdgeScraper().run({now, fetchText: async url => {requests.push(url); return html}, onAudit: value => audits.push(value)})
  gap(jobs)
  assert.deepEqual(requests, [URL])
  assert.equal(readInventoryEvidence(jobs).firstParty, false)
  assert.equal(audits[0].responses[0].transportQualified, false)
  assert.equal(audits[0].responses[0].status, null)
  assert.equal(audits[0].responses[0].bodyBase64, null)
  assert.match(audits[0].issues[0].kind, /unqualified/)
})

test('synthetic native transport replays the genuine saved bytes without claiming inventory freshness', async () => {
  const audits = [], requests = []
  const jobs = await threeEdge.run({now, fetchImpl: async (url, init) => {
    requests.push({url, ...init})
    return nativeResponse(finiteReader())
  }, onAudit: value => audits.push(value)})
  gap(jobs)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, URL)
  assert.equal(requests[0].redirect, 'manual')
  assert.equal(audits[0].responses[0].bodyBase64, body.toString('base64'))
  assert.equal(audits[0].responses[0].sha256, SHA)
  assert.equal(audits[0].responses[0].bytes, 8666)
  assert.equal(audits[0].responses[0].bodyComplete, true)
  assert.equal(audits[0].inventoryVerifiedAt, null)
  assert.equal(jobs.metadata.runtimeInventoryVerification, false)
})

test('preaborted public wrapper preserves an opaque falsy cancellation before any read or callback', async () => {
  const controller = new AbortController(); controller.abort(0)
  let calls = 0
  await rejection(threeEdge.run({signal: controller.signal, fetchPage: async () => {calls++; return original()},
    fetchText: async () => {calls++; return html}, onAudit: () => {calls++}}), reason => assert.strictEqual(reason, 0))
  assert.equal(calls, 0)
})

test('late cancellation settles a signal-ignoring injected homepage read with the exact caller reason', async () => {
  const controller = new AbortController(), entered = deferred(), pendingPage = deferred(), reason = Object.freeze({cancel: 'injected-read'})
  const fetchPage = () => {entered.resolve(); return pendingPage.promise}
  const pending = threeEdge.create3EdgeScraper().run({signal: controller.signal, fetchPage, fetchText: fetchPage, requestTimeoutMs: 200})
  pending.catch(() => {})
  await guarded(entered.promise); controller.abort(reason)
  await rejection(pending, error => assert.strictEqual(error, reason))
  pendingPage.resolve(original()); await tick()
})

test('native body cancellation preserves caller identity and cancels/releases a reader that ignores cancel', async () => {
  const controller = new AbortController(), entered = deferred(), reason = Object.freeze({cancel: 'native-body'})
  let cancelled = 0, released = 0
  const reader = {read() {entered.resolve(); return never()}, cancel() {cancelled++; return never()}, releaseLock() {released++}}
  const pending = threeEdge.run({signal: controller.signal, requestTimeoutMs: 200, fetchImpl: async () => nativeResponse(reader)})
  pending.catch(() => {})
  try {await guarded(entered.promise); controller.abort(reason); await rejection(pending, error => assert.strictEqual(error, reason))}
  finally {controller.abort(reason)}
  assert.equal(cancelled, 1)
  assert.equal(released, 1)
})

for (const name of ['onAudit', 'onMetadata', 'onRecords']) test(name + ' cancellation preserves the exact caller reason during an ignored callback', async () => {
  const controller = new AbortController(), reason = Object.freeze({cancel: name}), r = replay()
  await rejection(threeEdge.run({...r.options, signal: controller.signal, [name]: () => {controller.abort(reason); return never()}}), error => assert.strictEqual(error, reason))
})

test('per-request deadline independently bounds an injected fetch that ignores its signal', async () => {
  await rejection(threeEdge.run({fetchPage: never, requestTimeoutMs: 5, sourceTimeoutMs: 500}), deadline('request'))
})

test('per-request deadline cancels a late native response without acquiring its reader', async () => {
  const late = deferred(); let cancelled = 0, acquired = 0, signal
  const pending = threeEdge.run({fetchImpl: (_url, init) => {signal = init.signal; return late.promise}, requestTimeoutMs: 5, sourceTimeoutMs: 500})
  await rejection(pending, deadline('request'))
  assert.equal(signal.aborted, true)
  late.resolve({status: 200, url: URL, headers: new Headers({'content-type': 'text/html'}),
    body: {cancel() {cancelled++; return never()}, getReader() {acquired++; throw Error('late reader must not be acquired')}}})
  await tick(); await tick()
  assert.equal(cancelled, 1)
  assert.equal(acquired, 0)
})

test('entity body deadline independently bounds an ignored native read', async () => {
  let cancelled = 0, released = 0
  await rejection(threeEdge.run({fetchImpl: async () => nativeResponse({read: never, cancel() {cancelled++; return never()}, releaseLock() {released++}}),
    requestTimeoutMs: 500, entityTimeoutMs: 5, sourceTimeoutMs: 1000}), deadline('entity'))
  assert.equal(cancelled, 1)
  assert.equal(released, 1)
})

for (const name of ['onAudit', 'onMetadata', 'onRecords']) test(name + ' has its own deadline when its callback ignores cancellation', async () => {
  const r = replay()
  await rejection(threeEdge.run({...r.options, [name]: never, callbackTimeoutMs: 5, requestTimeoutMs: 500, sourceTimeoutMs: 1000}), deadline(name))
})

test('source deadline includes ignored audit delivery independently of request and callback bounds', async () => {
  const r = replay()
  await rejection(threeEdge.run({...r.options, onAudit: never, requestTimeoutMs: 500, callbackTimeoutMs: 500, sourceTimeoutMs: 5}), deadline('source'))
})

for (const transport of ['fetchPage', 'fetchImpl', 'fetchText']) test(transport + ' preserves the original thrown error while delivering failure audit', async () => {
  const error = Object.freeze(Error('original ' + transport)), audits = []
  await rejection(threeEdge.run({now, [transport]: async () => {throw error}, onAudit: value => audits.push(value)}), reason => assert.strictEqual(reason, error))
  assert.equal(audits.length, 1)
  assert.equal(audits[0].outcome, 'failed')
  assert.equal(audits[0].sourceScopeComplete, false)
})

for (const reason of [0, false, null, undefined, '']) test('an opaque falsy read rejection stays a failure (' + String(reason) + ')', async () => {
  const audits = []
  await rejection(threeEdge.run({fetchPage: () => {throw reason}, onAudit: audit => audits.push(audit)}), error => assert.strictEqual(error, reason))
  assert.equal(audits.length, 1)
  assert.equal(audits[0].outcome, 'failed')
})

test('native read errors retain identity and never wait for an ignored cancel promise', async () => {
  const error = Object.freeze(Error('original body read error')); let cancelled = 0, released = 0
  await rejection(threeEdge.run({fetchImpl: async () => nativeResponse({read() {throw error}, cancel() {cancelled++; return never()}, releaseLock() {released++}})}), reason => assert.strictEqual(reason, error))
  assert.equal(cancelled, 1)
  assert.equal(released, 1)
})

for (const name of ['onAudit', 'onMetadata', 'onRecords']) test(name + ' preserves the exact callback rejection', async () => {
  const r = replay(), error = Object.freeze(Error('original sink ' + name))
  await rejection(threeEdge.run({...r.options, [name]: () => {throw error}}), reason => assert.strictEqual(reason, error))
})

test('synchronous stream pull abort plus throw has no abandoned rejection and preserves opaque cancellation', async () => {
  const controller = new AbortController(), unhandled = [], listener = reason => unhandled.push(reason)
  process.on('unhandledRejection', listener)
  try {
    await rejection(threeEdge.run({signal: controller.signal, fetchImpl: async () => {
      const stream = new ReadableStream({pull() {controller.abort(0); throw Error('synthetic pull throw after abort')}}, {highWaterMark: 0})
      const response = new Response(stream, {status: 200, headers: {'content-type': 'text/html'}})
      Object.defineProperty(response, 'url', {value: URL})
      return response
    }}), reason => assert.strictEqual(reason, 0))
    await tick(); await tick()
    assert.deepEqual(unhandled, [])
  } finally {process.removeListener('unhandledRejection', listener)}
})

for (const status of [301, 302, 401, 403, 404, 429, 451, 500]) test('original HTTP ' + status + ' fails closed without route retries or reading a rejected native body', async () => {
  let requests = 0, cancelled = 0, acquired = 0
  const audits = [], heldHosts = new Set()
  await rejection(threeEdge.run({heldHosts, onAudit: value => audits.push(value), fetchImpl: async (url, init) => {
    requests++; assert.equal(url, URL); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
    return {status, url, headers: new Headers({'content-type': 'text/html', location: 'https://other.invalid/careers'}),
      body: {cancel() {cancelled++; return never()}, getReader() {acquired++; throw Error('rejected status body read')}}}
  }}), error => {assert.equal(error.status, status); assert.equal(error.abortRetries, true); assert.equal(error.lifecycleCleanupAllowed, false)})
  assert.equal(requests, 1)
  assert.equal(cancelled, 1)
  assert.equal(acquired, 0)
  assert.equal(audits[0].responses[0].status, status)
  assert.equal(audits[0].responses[0].bodyBase64, null)
  if ([401, 403, 429, 451].includes(status)) assert.equal(heldHosts.has('3edge.com'), true)
})

test('an already denied host cannot be retried through another supplied transport', async () => {
  const heldHosts = new Set(['3edge.com']); let calls = 0
  await rejection(threeEdge.run({heldHosts, fetchPage: async () => {calls++; return original()}, fetchText: async () => {calls++; return html}}), error => assert.match(error.message, /held|denied/i))
  assert.equal(calls, 0)
})

for (const [name, mutate] of [
  ['wrong original URL', page => ({...page, url: 'https://other.invalid/'})],
  ['missing original URL', page => {delete page.url; return page}],
  ['changed final URL', page => ({...page, finalUrl: 'https://3edge.com/careers'})],
  ['wrong requested URL', page => ({...page, requestedUrl: 'https://3edge.com/jobs'})],
  ['missing original bytes', page => {delete page.bodyBase64; return {...page, html}}],
  ['empty original bytes', page => ({...page, bodyBase64: ''})],
  ['malformed original base64', page => ({...page, bodyBase64: 'not!!base64'})],
  ['contradictory decoded text', page => ({...page, html: '<p>different body</p>'})],
  ['invalid original UTF8', page => ({...page, bodyBase64: Buffer.from([0xff, 0xfe]).toString('base64')})],
  ['wrong publisher title', () => changed('<title>Unrelated company</title><p>3Edge Technologies: When it comes down to IT</p>')],
  ['inert publisher title', () => changed('<template><title>3Edge Technologies: When it comes down to IT</title></template><title>Other</title>')],
  ['unqualified MIME type', page => ({...page, headers: {'content-type': 'application/json'}})],
]) test(name + ' cannot become an empty successful public read', async () => {
  const r = replay(mutate)
  await rejection(threeEdge.run(r.options), error => {assert.equal(error.softFailure, true); assert.equal(error.lifecycleCleanupAllowed, false); assert.equal(error.inventoryEvidence.status, 'coverage-gap')})
  assert.equal(r.requests.length, 1)
  assert.equal(r.audits.length, 1)
  assert.equal(r.audits[0].outcome, 'failed')
})

for (const limit of ['maxResponseBytes', 'maxSourceBytes', 'maxTotalBytes']) test(limit + ' rejects decoded original bytes above its independent budget', async () => {
  const r = replay()
  await rejection(threeEdge.run({...r.options, [limit]: 8665}), error => assert.match(error.message, /byte|budget|limit/i))
  assert.equal(r.requests.length, 1)
  assert.equal(r.audits[0].sourceScopeComplete, false)
})

test('native declared byte overflow is rejected before reader acquisition', async () => {
  let acquired = 0, cancelled = 0
  await rejection(threeEdge.run({maxResponseBytes: 100, fetchImpl: async () => ({status: 200, url: URL,
    headers: new Headers({'content-type': 'text/html', 'content-length': '101'}),
    body: {getReader() {acquired++; return finiteReader()}, cancel() {cancelled++; return never()}}})}), error => assert.match(error.message, /byte|limit/i))
  assert.equal(acquired, 0)
  assert.equal(cancelled, 1)
})

test('native intrinsic Uint8Array length defeats a spoofed chunk byteLength', async () => {
  const bytes = new Uint8Array(101); Object.defineProperty(bytes, 'byteLength', {value: 0})
  await rejection(threeEdge.run({maxResponseBytes: 100, fetchImpl: async () => nativeResponse(finiteReader(bytes))}), error => assert.match(error.message, /byte|limit/i))
})

for (const [name, value] of [
  ['requestTimeoutMs', 0], ['requestTimeoutMs', NaN], ['requestTimeoutMs', 30001],
  ['entityTimeoutMs', -1], ['sourceTimeoutMs', Infinity], ['callbackTimeoutMs', 0],
  ['maxResponseBytes', 0], ['maxSourceBytes', 1.5], ['maxTotalBytes', -1],
  ['maxRequests', 0], ['maxPages', 0], ['maxJobs', -1], ['now', () => 'invalid-clock'],
  ['now', 'invalid-clock-function'], ['monotonicNow', () => NaN], ['monotonicNow', () => -1],
]) test('invalid ' + name + ' control is rejected before reads and timer allocation (' + String(value) + ')', async () => {
  let calls = 0, timers = 0
  const originalTimeout = globalThis.setTimeout
  globalThis.setTimeout = (...args) => {timers++; return originalTimeout(...args)}
  try {
    await rejection(threeEdge.run({[name]: value, fetchPage: async () => {calls++; return original()}, fetchText: async () => {calls++; return html}}), error => assert.match(error.message, /invalid|clock|limit/i))
    assert.equal(calls, 0)
    assert.equal(timers, 0)
  } finally {globalThis.setTimeout = originalTimeout}
})

for (const [name, content, kind] of [
  ['same-origin careers link', '<a href="/careers">Careers</a>', 'declared-link'],
  ['JobPosting object', '<script type="application/ld+json">{"@type":"JobPosting","title":"Synthetic engineer"}</script>', 'jobposting-marker'],
  ['nonempty openings', '<h2>Current openings</h2><h3>Synthetic backend engineer</h3>', 'hiring-signal'],
  ['declared recruiting script', '<script src="https://jobs.lever.co/example/widget.js"></script>', 'declared-script'],
  ['declared recruiting frame', '<iframe src="https://jobs.example.invalid/jobs"></iframe>', 'declared-frame'],
]) test('changed ' + name + ' remains an unresolved diagnostic lead instead of authoritative empty', async () => {
  const r = replay(() => changed(document(content)))
  const jobs = await threeEdge.run({...r.options, maxRequests: 128, maxPages: 128, maxJobs: 0})
  gap(jobs)
  assert.equal(r.requests.length, 1)
  assert.ok(r.audits[0].observations.some(row => row.kind === kind))
  assert.ok(r.audits[0].observations.every(row => row.enumerated === false && row.vacancyCount === null))
  assert.equal(r.audits[0].companyGlobalTotal, null)
  assert.deepEqual(r.records, [[]])
})

test('inert recruiting examples do not activate a route or invent vacancy observations', async () => {
  const r = replay(() => changed(document('<!-- <a href="/careers">Careers</a> --><template><script>{"@type":"JobPosting"}</script><a href="/jobs">Jobs</a></template><p>Corporate services.</p>')))
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.deepEqual(r.audits[0].observations, [])
  assert.equal(r.requests.length, 1)
})

test('metadata, audit and records callbacks are awaited and cannot mutate retained result evidence', async () => {
  const r = replay(), completed = []
  const jobs = await threeEdge.run({...r.options,
    onMetadata: async value => {await tick(); value.lifecycleCleanupAllowed = true; completed.push('metadata')},
    onAudit: async value => {await tick(); value.responses[0].bodyBase64 = 'corrupt sink edit'; value.companyGlobalTotal = 0; completed.push('audit')},
    onRecords: async value => {await tick(); value.push({title: 'invented sink vacancy'}); completed.push('records')}})
  gap(jobs)
  assert.deepEqual(completed, ['metadata', 'audit', 'records'])
  assert.equal(jobs.nativeEvidence.responses[0].bodyBase64, body.toString('base64'))
  assert.equal(jobs.nativeEvidence.responses[0].sha256, SHA)
  assert.equal(jobs.metadata.lifecycleCleanupAllowed, false)
})

test('per-request deadline checks synchronous blocking work before accepting headers', async () => {
  await rejection(threeEdge.run({requestTimeoutMs: 1, sourceTimeoutMs: 1000, fetchImpl: () => {
    const start = performance.now(); while (performance.now() - start < 20) {}
    return nativeResponse(finiteReader())
  }}), deadline('request'))
})

test('entity deadline checks synchronous blocking work before accepting body bytes', async () => {
  await rejection(threeEdge.run({requestTimeoutMs: 1000, entityTimeoutMs: 1, sourceTimeoutMs: 2000,
    fetchImpl: async () => nativeResponse(finiteReader(new Uint8Array(body), () => {const start = performance.now(); while (performance.now() - start < 20) {}}))}), deadline('entity'))
})

test('success, original failures and cancellation clear every allocated deadline timer', async () => {
  const handles = new Set(), nativeSet = globalThis.setTimeout, nativeClear = globalThis.clearTimeout
  globalThis.setTimeout = (...args) => {const handle = nativeSet(...args); handles.add(handle); return handle}
  globalThis.clearTimeout = handle => {handles.delete(handle); return nativeClear(handle)}
  try {
    const r = replay(); gap(await threeEdge.run(r.options)); await tick(); assert.equal(handles.size, 0)
    const error = Error('timer cleanup transport failure')
    await rejection(threeEdge.run({fetchPage: () => {throw error}}), reason => assert.strictEqual(reason, error))
    await tick(); assert.equal(handles.size, 0)
    const controller = new AbortController(), entered = deferred()
    const pending = threeEdge.run({signal: controller.signal, fetchPage: () => {entered.resolve(); return never()}})
    pending.catch(() => {}); await guarded(entered.promise); controller.abort(0)
    await rejection(pending, reason => assert.strictEqual(reason, 0)); await tick(); assert.equal(handles.size, 0)
  } finally {globalThis.setTimeout = nativeSet; globalThis.clearTimeout = nativeClear; for (const handle of handles) nativeClear(handle)}
})

// C31 combined review R08: browser loading does not depend on CSS visibility.
// The controls exercise real source discovery; no declaration is fetched/run.
const reviewScriptURL = 'https://jobs.lever.co/independent-synthetic/widget.js'
for (const [name, content] of [
  ['hidden ancestor', '<div hidden><script src="' + reviewScriptURL + '"></script></div>'],
  ['display-none ancestor', '<div style="display: none"><script src="' + reviewScriptURL + '"></script></div>'],
  ['visibility-hidden script', '<script style="visibility:hidden" src="' + reviewScriptURL + '"></script>'],
  ['aria-hidden and inert ancestor', '<div aria-hidden="true" inert><script src="' + reviewScriptURL + '"></script></div>'],
  ['hidden module script', '<script hidden type="module" src="' + reviewScriptURL + '"></script>'],
  ['hidden JavaScript MIME script', '<script hidden type="text/javascript" src="' + reviewScriptURL + '"></script>'],
  ['HTML integration within SVG', '<svg><foreignObject><div hidden><script src="' + reviewScriptURL + '"></script></div></foreignObject></svg>'],
  ['HTML integration within MathML', '<math><annotation-xml encoding="text/html"><div hidden><script src="' + reviewScriptURL + '"></script></div></annotation-xml></math>'],
]) test('R08 retains browser-active recruiting script under ' + name, async () => {
  const r = replay(() => changed(document(content + '<p>Corporate services.</p>')))
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.equal(r.requests.length, 1)
  const leads = jobs.nativeEvidence.observations.filter(row => row.kind === 'declared-script')
  assert.equal(leads.length, 1)
  assert.equal(leads[0].url, reviewScriptURL)
  assert.equal(leads[0].followed, false)
  assert.equal(leads[0].enumerated, false)
  assert.equal(leads[0].vacancyCount, null)
  assert.equal(jobs.nativeEvidence.observations.some(row => row.kind === 'hiring-signal'), false)
})

for (const [name, content] of [
  ['template subtree', '<template><script src="' + reviewScriptURL + '"></script></template>'],
  ['hidden template subtree', '<template hidden><div><script src="' + reviewScriptURL + '"></script></div></template>'],
  ['comment', '<!-- <script src="' + reviewScriptURL + '"></script> -->'],
  ['textarea raw text', '<textarea><script src="' + reviewScriptURL + '"></script></textarea>'],
  ['noscript raw fallback', '<noscript><script src="' + reviewScriptURL + '"></script></noscript>'],
  ['plain-text script data', '<script type="text/plain" src="' + reviewScriptURL + '"></script>'],
  ['JSON script data', '<script type="application/json" src="' + reviewScriptURL + '"></script>'],
  ['JSON-LD external data', '<script type="application/ld+json" src="' + reviewScriptURL + '"></script>'],
  ['unsupported script language', '<script language="not-javascript" src="' + reviewScriptURL + '"></script>'],
  ['classic nomodule script', '<script nomodule src="' + reviewScriptURL + '"></script>'],
  ['SVG script src attribute', '<svg><script src="' + reviewScriptURL + '"></script></svg>'],
  ['MathML script src attribute', '<math><script src="' + reviewScriptURL + '"></script></math>'],
  ['lookalike data-src attribute', '<script data-src="' + reviewScriptURL + '"></script>'],
  ['later duplicate src attribute', '<script src="/ordinary.js" src="' + reviewScriptURL + '"></script>'],
  ['unsupported element subtree', '<div!><script src="' + reviewScriptURL + '"></script></div!>'],
]) test('R08 does not activate ' + name, async () => {
  const r = replay(() => changed(document(content + '<p>Corporate services.</p>')))
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.equal(r.requests.length, 1)
  assert.deepEqual(jobs.nativeEvidence.observations, [])
})

test('R08 hidden HTML frame navigation retains an unresolved recruiting lead', async () => {
  const url = 'https://jobs.example.invalid/jobs'
  const r = replay(() => changed(document('<div hidden><iframe src="' + url + '"></iframe></div><p>Corporate services.</p>')))
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.equal(r.requests.length, 1)
  assert.equal(jobs.nativeEvidence.observations[0]?.kind, 'declared-frame')
  assert.equal(jobs.nativeEvidence.observations[0]?.url, url)
  assert.equal(jobs.nativeEvidence.observations[0]?.followed, false)
})

for (const [name, content] of [
  ['template frame', '<template><iframe src="https://jobs.example.invalid/jobs"></iframe></template>'],
  ['srcdoc overriding src', '<div hidden><iframe src="https://jobs.example.invalid/jobs" srcdoc="Corporate only"></iframe></div>'],
  ['SVG iframe lookalike', '<svg><iframe src="https://jobs.example.invalid/jobs"></iframe></svg>'],
]) test('R08 does not activate ' + name, async () => {
  const r = replay(() => changed(document(content)))
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.deepEqual(jobs.nativeEvidence.observations, [])
})

test('R08 hidden JSON-LD retains a JobPosting diagnostic independently of visible hiring text', async () => {
  const r = replay(() => changed(document('<div hidden><script type="application/ld+json">{"@type":"JobPosting","title":"Synthetic role"}</script></div><p>Corporate services.</p>')))
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.equal(jobs.nativeEvidence.observations[0]?.kind, 'jobposting-marker')
  assert.equal(jobs.nativeEvidence.observations[0]?.parsedAsVacancy, false)
  assert.equal(jobs.nativeEvidence.observations.some(row => row.kind === 'hiring-signal'), false)
})

test('R08 preserves an existing visible inline JobPosting data diagnostic without activating its script type', async () => {
  const r = replay(() => changed(document('<script type="application/json">{"@type":"JobPosting","title":"Synthetic data role"}</script><p>Corporate services.</p>')))
  const jobs = await threeEdge.run(r.options)
  gap(jobs)
  assert.equal(jobs.nativeEvidence.observations[0]?.kind, 'jobposting-marker')
  assert.equal(jobs.nativeEvidence.observations[0]?.parsedAsVacancy, false)
  assert.equal(jobs.nativeEvidence.observations.some(row => row.kind === 'declared-script'), false)
  assert.equal(r.requests.length, 1)
})

// C31 combined review R09: the real default catalog decorates even empty arrays.
test('R09 default catalog retains full original homepage audit without an optional sink', async () => {
  const provider = getScraperCatalog().find(row => row.source === '3edge')
  assert.ok(provider)
  const requests = []
  const jobs = await createCatalogScraper(provider).run({now, fetchPage: async url => {requests.push(url); return original()}})
  assert.equal(jobs.length, 0)
  assert.deepEqual(requests, [URL])
  const audit = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')?.value
  assert.equal(audit?.responses?.[0]?.status, 200)
  assert.equal(audit.responses[0].bodyBase64, body.toString('base64'))
  assert.equal(audit.responses[0].sha256, SHA)
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-06T21:00:04.250Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-06T21:00:15.345Z')
  assert.deepEqual(audit.rawPages[0].originalReceipt, receipt)
  assert.deepEqual(audit.observations, [])
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.companyGlobalTotal, null)
  assert.equal(audit.companyIndiaTotal, null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.deepEqual(readSourceObservationEvidence(jobs, '3edge'), {source: '3edge', recordKind: 'hiring-signals',
    observedRecordCount: 0, observedVacancyCount: 0, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null})
})

test('R09 default catalog retains complete unresolved leads beside the normalized immutable summary', async () => {
  const provider = getScraperCatalog().find(row => row.source === '3edge')
  const content = document('<div hidden><script src="' + reviewScriptURL + '"></script></div><p>Corporate services.</p>')
  const jobs = await createCatalogScraper(provider).run({now, fetchPage: async () => changed(content)})
  const audit = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')?.value
  assert.equal(audit?.observations?.length, 1)
  assert.equal(audit.observations[0].url, reviewScriptURL)
  assert.equal(audit.rawPages[0].bodyBase64, Buffer.from(content).toString('base64'))
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-07T00:00:00.001Z')
  const summary = readSourceObservationEvidence(jobs, '3edge')
  assert.equal(Object.isFrozen(summary), true)
  assert.deepEqual(summary, {source: '3edge', recordKind: 'hiring-signals', observedRecordCount: 1,
    observedVacancyCount: 0, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null})
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
})
