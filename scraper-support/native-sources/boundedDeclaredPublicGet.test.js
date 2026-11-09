import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { createNativeGreenhouseScraper } from './declaredGreenhouse/nativeCareers.js'
import { createDeclaredJobFeedScraper } from './declaredJobFeeds/nativeCareers.js'

// Deliberately synthetic HTTP and reader ownership controls. No employer/source
// inventory claim or historical captured response is derived from these tests.
globalThis.fetch = () => { throw Error('Synthetic declared transport tests forbid network') }
const MiB = 1024 * 1024
let serial = 0
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const observe = (promise, ms = 100) => Promise.race([promise, pause(ms).then(() => ({ pending: true }))])
const profile = (platform = 'greenhouse') => {
  const host = 'declared-transport-' + ++serial
  return { source: 'synthetic-' + host, platform, countryFilter: 'Global', boardToken: 'audit', boardSlug: 'audit',
    companyName: 'Synthetic Audit', publisherName: 'Synthetic Audit', primaryTitleSignals: ['Synthetic Audit'],
    primaryURL: 'https://' + host + '.invalid/careers', primaryPages: ['https://' + host + '.invalid/careers'],
    publicAPIBase: 'https://' + host + '-native.invalid/board', publicAPIURL: 'https://' + host + '-native.invalid/jobs',
    boardURL: 'https://' + host + '-board.invalid/audit',
    declaration: { kind: 'active-native-board-link', boardURL: 'https://' + host + '-board.invalid/audit' } }
}
const heldResponse = url => {
  const value = new Response('Synthetic unavailable page', { status: 503 })
  Object.defineProperty(value, 'url', { value: url }); return value
}
const trackedResponse = (url, { bytes = 0, stalled = false, status = 200 } = {}) => {
  const stats = { bytes: 0, eof: false, canceled: 0, cancelReason: null, released: 0, arrayBufferCalls: 0 }
  let controller, left = bytes, terminated = false
  const close = () => { if (!terminated) { terminated = true; stats.eof = true; controller.close() } }
  const body = new ReadableStream({
    start(value) { controller = value },
    pull(value) {
      if (stalled) return
      if (!left) { close(); return }
      const chunk = new Uint8Array(Math.min(left, MiB)); chunk.fill(32)
      left -= chunk.byteLength; stats.bytes += chunk.byteLength; value.enqueue(chunk)
    },
    cancel(reason) { terminated = true; stats.canceled++; stats.cancelReason = reason }
  }, { highWaterMark: 0 })
  const getReader = body.getReader.bind(body)
  body.getReader = () => {
    const reader = getReader(), release = reader.releaseLock.bind(reader)
    reader.releaseLock = () => { stats.released++; return release() }
    return reader
  }
  const response = new Response(body, { status, headers: { 'content-type': 'text/plain', 'x-synthetic-original': 'retained' } })
  Object.defineProperty(response, 'url', { value: url })
  const arrayBuffer = response.arrayBuffer.bind(response)
  response.arrayBuffer = () => { stats.arrayBufferCalls++; return arrayBuffer() }
  return { response, stats, close }
}
const runFirst = (factory, p, first, options = {}) => {
  let count = 0
  return factory(p).run({ ...options, fetchImpl: async (url, init) => {
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual')
    assert.equal(init.headers.Accept, 'text/html,application/json,*/*;q=0.5')
    return ++count === 1 ? first : heldResponse(url)
  } })
}

for (const [name, factory, platform] of [
  ['Greenhouse', createNativeGreenhouseScraper, 'greenhouse'],
  ['job feeds', createDeclaredJobFeedScraper, 'ashby']
]) test(name + ' cancels at the first overflowing chunk without consuming the tail', async () => {
  const p = profile(platform), stream = trackedResponse(p.primaryURL, { bytes: 20 * MiB })
  const jobs = await runFirst(factory, p, stream.response)
  const failure = jobs.sourceAudit.rawPages[0]
  assert.match(failure.error.message, /native entity exceeds input limit/)
  assert.equal(stream.stats.bytes, 17 * MiB, 'only the first overflow chunk may be obtained')
  assert.equal(stream.stats.eof, false, 'the unread tail must be canceled')
  assert.equal(stream.stats.canceled, 1); assert.equal(stream.stats.released, 1)
  assert.equal(stream.stats.arrayBufferCalls, 0)
  assert.equal(stream.response.body.locked, false)
})

test('a full 16 MiB entity keeps its original HTTP envelope and releases the successful reader', async () => {
  const p = profile(), stream = trackedResponse(p.primaryURL, { bytes: 16 * MiB, status: 503 })
  const jobs = await runFirst(createNativeGreenhouseScraper, p, stream.response)
  const page = jobs.sourceAudit.rawPages[0]
  assert.equal(page.bytes, 16777216); assert.equal(page.status, 503); assert.equal(page.finalURL, p.primaryURL)
  assert.equal(page.transportQualified, true); assert.equal(page.headers['x-synthetic-original'], 'retained')
  const original = Buffer.from(page.bodyBase64, 'base64')
  assert.equal(original.length, 16777216); assert.equal(original[0], 32); assert.equal(original.at(-1), 32)
  assert.equal(stream.stats.eof, true); assert.equal(stream.stats.canceled, 0)
  assert.equal(stream.stats.released, 1); assert.equal(stream.stats.arrayBufferCalls, 0)
  assert.equal(stream.response.body.locked, false)
})

test('caller abort rejects promptly with its exact reason and owns a late response body', async () => {
  const p = profile(), caller = new AbortController(), reason = Error('Synthetic caller reason')
  const entered = deferred(), deliver = deferred(), late = trackedResponse(p.primaryURL, { stalled: true })
  let signal
  const running = createNativeGreenhouseScraper(p).run({ signal: caller.signal,
    fetchImpl: async (_url, init) => { signal = init.signal; entered.resolve(); return deliver.promise }
  }).then(value => ({ value }), error => ({ error }))
  await entered.promise; caller.abort(reason)
  const early = await observe(running)
  deliver.resolve(late.response); await pause(20)
  const canceledBeforeHarnessCleanup = late.stats.canceled
  late.close(); const final = await running
  assert.equal(early.error, reason, 'must reject before late delivery')
  assert.equal(final.error, reason); assert.equal(canceledBeforeHarnessCleanup, 1)
  assert.equal(late.stats.cancelReason, reason); assert.equal(late.stats.arrayBufferCalls, 0)
  assert.equal(late.response.body.locked, false); assert.equal(getEventListeners(signal, 'abort').length, 0)
})

test('the request deadline releases an ignoring fetch and cancels its eventual body with the timeout reason', async t => {
  const originalTimeout = AbortSignal.timeout
  t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 15000); return originalTimeout(20) })
  const p = profile(), caller = new AbortController(), stop = Error('Synthetic next-request cleanup')
  const entered = deferred(), next = deferred(), deliver = deferred(), late = trackedResponse(p.primaryURL, { stalled: true })
  let count = 0, signal, audit
  const running = createNativeGreenhouseScraper(p).run({ signal: caller.signal, onAudit: value => { audit = value },
    fetchImpl: async (url, init) => {
      if (++count === 1) { signal = init.signal; entered.resolve(); return deliver.promise }
      next.resolve(); caller.abort(stop); return heldResponse(url)
    }
  }).then(value => ({ value }), error => ({ error }))
  await entered.promise
  const continuedBeforeDelivery = await observe(next.promise.then(() => ({ continued: true })), 150)
  deliver.resolve(late.response); await pause(20)
  const canceledBeforeHarnessCleanup = late.stats.canceled
  late.close(); const final = await running
  assert.equal(continuedBeforeDelivery.continued, true, 'timed-out fetch must not hold the collector')
  assert.equal(final.error, stop)
  assert.equal(audit, undefined, 'caller cancellation must prevent the later audit callback')
  assert.equal(canceledBeforeHarnessCleanup, 1); assert.equal(late.stats.cancelReason, signal.reason)
  assert.equal(signal.reason.name, 'TimeoutError'); assert.equal(late.stats.arrayBufferCalls, 0)
  assert.equal(getEventListeners(signal, 'abort').length, 0)
})

for (const asynchronous of [false, true]) test('synthetic ' + (asynchronous ? 'asynchronous' : 'synchronous') + ' reader acquisition failure cancels its body', async () => {
  const p = profile(), reason = Error('Synthetic reader acquisition failed')
  let canceled = 0, cancelReason, acquired = 0
  const first = { url: p.primaryURL, status: 200, headers: new Headers(),
    body: { getReader() { acquired++; if (asynchronous) return Promise.reject(reason); throw reason },
      cancel(value) { canceled++; cancelReason = value; return Promise.reject(Error('Synthetic cancel rejection')) } },
    arrayBuffer: async () => new ArrayBuffer(0) }
  const jobs = await runFirst(createNativeGreenhouseScraper, p, first)
  assert.equal(jobs.sourceAudit.rawPages[0].error?.message, reason.message)
  assert.equal(acquired, 1); assert.equal(canceled, 1); assert.equal(cancelReason, reason)
})

test('a synthetic reader delivered after cancellation is canceled and released without a read', async () => {
  const p = profile(), caller = new AbortController(), reason = Error('Synthetic pending acquisition abort')
  const entered = deferred(), acquire = deferred(), fallback = deferred()
  const stats = { read: 0, canceled: 0, released: 0 }
  const reader = { read() { stats.read++; return Promise.resolve({ done: true }) },
    cancel(value) { stats.canceled++; assert.equal(value, reason); return new Promise(() => {}) },
    releaseLock() { stats.released++ } }
  const first = { url: p.primaryURL, status: 200, headers: new Headers(),
    body: { getReader() { entered.resolve(); return acquire.promise }, cancel() { return Promise.reject(Error('Synthetic locked body')) } },
    arrayBuffer() { entered.resolve(); return fallback.promise } }
  const running = runFirst(createNativeGreenhouseScraper, p, first, { signal: caller.signal })
    .then(value => ({ value }), error => ({ error }))
  await entered.promise; caller.abort(reason)
  const early = await observe(running)
  acquire.resolve(reader); fallback.resolve(new ArrayBuffer(0)); await pause(20)
  const final = await running
  assert.equal(early.error, reason); assert.equal(final.error, reason)
  assert.deepEqual(stats, { read: 0, canceled: 1, released: 1 })
})

test('aborting a pending synthetic read releases its lock even when cancel throws and the read later rejects', async () => {
  const p = profile(), caller = new AbortController(), reason = Error('Synthetic pending read abort')
  const entered = deferred(), readResult = deferred(), fallback = deferred()
  const stats = { canceled: 0, released: 0 }
  let signal
  const reader = { read() { entered.resolve(); return readResult.promise.then(() => { throw Error('Synthetic late read rejection') }) },
    cancel(value) { stats.canceled++; assert.equal(value, reason); throw Error('Synthetic cancel throws') },
    releaseLock() { stats.released++ } }
  const first = { url: p.primaryURL, status: 200, headers: new Headers(), body: { getReader: () => reader },
    arrayBuffer() { entered.resolve(); return fallback.promise } }
  const running = createNativeGreenhouseScraper(p).run({ signal: caller.signal,
    fetchImpl: async (_url, init) => { signal = init.signal; return first }
  }).then(value => ({ value }), error => ({ error }))
  await entered.promise; caller.abort(reason)
  const early = await observe(running)
  readResult.resolve(); fallback.resolve(new ArrayBuffer(0)); const final = await running; await pause(20)
  assert.equal(early.error, reason); assert.equal(final.error, reason)
  assert.deepEqual(stats, { canceled: 1, released: 1 })
  assert.equal(getEventListeners(signal, 'abort').length, 0)
})

for (const [name, chunk] of [['string', 'not bytes'], ['array', [32]], ['forged prototype', Object.create(Uint8Array.prototype)]])
test('a synthetic ' + name + ' chunk is rejected before byte allocation', async () => {
  const p = profile(), stats = { canceled: 0, released: 0, arrayBufferCalls: 0 }
  const reader = { read: async () => ({ done: false, value: chunk }),
    cancel() { stats.canceled++; return Promise.resolve() }, releaseLock() { stats.released++ } }
  const first = { url: p.primaryURL, status: 200, headers: new Headers(), body: { getReader: () => reader },
    async arrayBuffer() { stats.arrayBufferCalls++; return new ArrayBuffer(0) } }
  const jobs = await runFirst(createNativeGreenhouseScraper, p, first)
  assert.equal(jobs.sourceAudit.rawPages[0].error?.name, 'TypeError')
  assert.match(jobs.sourceAudit.rawPages[0].error?.message, /Uint8Array/)
  assert.deepEqual(stats, { canceled: 1, released: 1, arrayBufferCalls: 0 })
})

test('an oversized Uint8Array cannot hide its actual byte length behind an own property', async () => {
  const p = profile(), chunk = new Uint8Array(17 * MiB), stats = { canceled: 0, released: 0 }
  Object.defineProperty(chunk, 'byteLength', { value: 1 })
  const reader = { read: async () => ({ done: false, value: chunk }),
    cancel() { stats.canceled++; return Promise.resolve() }, releaseLock() { stats.released++ } }
  const first = { url: p.primaryURL, status: 200, headers: new Headers(), body: { getReader: () => reader },
    arrayBuffer: async () => new ArrayBuffer(0) }
  const jobs = await runFirst(createNativeGreenhouseScraper, p, first)
  assert.match(jobs.sourceAudit.rawPages[0].error?.message ?? '', /native entity exceeds input limit/)
  assert.deepEqual(stats, { canceled: 1, released: 1 })
})

for (const stage of ['fetch', 'metadata iterator']) test('a synchronous synthetic ' + stage + ' cannot deliver after the monotonic request deadline', async t => {
  let clock = 0
  t.mock.method(performance, 'now', () => clock)
  const p = profile(), stats = { canceled: 0, released: 0 }
  const headers = stage === 'metadata iterator' ? { *[Symbol.iterator]() { clock = 15001; yield ['content-type', 'text/plain'] } } : new Headers()
  const reader = { read: async () => ({ done: true }), cancel() { stats.canceled++; return Promise.resolve() },
    releaseLock() { stats.released++ } }
  const first = { url: p.primaryURL, status: 200, headers,
    body: { getReader: () => reader, cancel() { stats.canceled++; return Promise.resolve() } },
    arrayBuffer: async () => new ArrayBuffer(0) }
  let count = 0
  const jobs = await createNativeGreenhouseScraper(p).run({ fetchImpl: async url => {
    if (++count === 1) { if (stage === 'fetch') clock = 15001; return first }
    return heldResponse(url)
  } })
  assert.equal(jobs.sourceAudit.rawPages[0].error?.name, 'TimeoutError')
  assert.equal(jobs.sourceAudit.rawPages[0].transportQualified, false)
  assert.equal(stats.canceled, 1)
  assert.equal(stats.released, stage === 'fetch' ? 0 : 1)
})
