import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchNativePacket } from './nativeTransport.js'
import { CAREERS_URL, EMBED_URL, CLIENT_URL, TITLES_URL } from './nativeContract.js'
const response = (body = '<h1>Career</h1>', { status = 200, url = CAREERS_URL, type = 'text/html', headers = {} } = {}) => {
  const result = new Response(body, { status, headers: { 'content-type': type, ...headers } })
  Object.defineProperty(result, 'url', { value: url })
  return result
}
test('bounded native GET keeps actual bytes, exact URL and explicitly injected historical clock', async () => {
  const calls = [], text = '<h1>Career</h1>'
  const packet = await fetchNativePacket(CAREERS_URL, { fetchImpl: async (url, options) => { calls.push({ url, ...options }); return response(text) }, captureClock: phase => phase === 'startedAt' ? '2026-10-31T18:22:46.791Z' : '2026-10-31T18:22:48.655Z' })
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'GET'); assert.equal(calls[0].redirect, 'manual')
  assert.equal(packet.body, text); assert.equal(packet.bytes, Buffer.byteLength(text))
  assert.equal(packet.capturedAt, '2026-10-31T18:22:48.655Z'); assert.equal(packet.captureClockInjected, true)
})
test('only the observed embed redirect is admitted and it is returned without automatic following', async () => {
  let calls = 0
  const packet = await fetchNativePacket(EMBED_URL, { fetchImpl: async () => { calls++; return response('Redirect', { status: 302, url: EMBED_URL, headers: { location: CLIENT_URL } }) } })
  assert.equal(calls, 1); assert.equal(packet.status, 302); assert.equal(packet.redirectLocation, CLIENT_URL)
  await assert.rejects(fetchNativePacket(EMBED_URL, { fetchImpl: async () => response('', { status: 302, url: EMBED_URL, headers: { location: 'https://other.invalid/client.js' } }) }))
})
test('unadvertised endpoints cannot reach transport', async () => {
  let called = false
  await assert.rejects(fetchNativePacket('https://apply.workable.com/api/v3/accounts/guessed/jobs', { fetchImpl: async () => { called = true } }))
  assert.equal(called, false)
})
for (const status of [401, 403, 404, 429, 500]) test('native HTTP' + status + ' stops with one request and unknown totals', async () => {
  let calls = 0, cancelled = 0
  const body = new ReadableStream({ cancel() { cancelled++ } })
  await assert.rejects(fetchNativePacket(CAREERS_URL, { fetchImpl: async () => { calls++; return response(body, { status }) } }), error => error.status === status && error.abortRetries === true && error.inventoryEvidence.reportedTotal === null)
  assert.equal(calls, 1); assert.equal(cancelled, 1)
})
test('automatic final URL changes and unsupported content type fail closed', async () => {
  await assert.rejects(fetchNativePacket(CAREERS_URL, { fetchImpl: async () => response('', { url: 'https://other.invalid/career/' }) }))
  await assert.rejects(fetchNativePacket(TITLES_URL, { fetchImpl: async () => response('{}', { url: TITLES_URL, type: 'text/html' }) }))
})
test('oversized content length is rejected before body read and cancellation settles it', async () => {
  let cancelled = 0
  const body = new ReadableStream({ cancel() { cancelled++ } })
  await assert.rejects(fetchNativePacket(CAREERS_URL, { maximumBytes: 100, fetchImpl: async () => response(body, { headers: { 'content-length': '101' } }) }), /oversized/i)
  assert.equal(cancelled, 1)
})
test('a streamed overrun cancels the reader and releases the lock', async () => {
  let cancelled = 0
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(101)) }, cancel() { cancelled++ } })
  await assert.rejects(fetchNativePacket(CAREERS_URL, { maximumBytes: 100, fetchImpl: async () => response(body) }), /oversized/i)
  assert.equal(cancelled, 1); assert.equal(body.locked, false)
})
test('a pre-aborted caller reason reaches the caller without a request', async () => {
  const controller = new AbortController(), reason = Object.freeze({ code: 'controlled-caller' }); controller.abort(reason)
  let calls = 0
  await assert.rejects(fetchNativePacket(CAREERS_URL, { signal: controller.signal, fetchImpl: async () => { calls++ } }), error => error === reason)
  assert.equal(calls, 0)
})
test('caller cancellation after headers cancels the body using the exact reason', async () => {
  const controller = new AbortController(), reason = new Error('Caller after headers'), cancelled = []
  const body = new ReadableStream({ cancel(value) { cancelled.push(value) } })
  await assert.rejects(fetchNativePacket(CAREERS_URL, { signal: controller.signal, fetchImpl: async () => { controller.abort(reason); return response(body) } }), error => error === reason)
  assert.deepEqual(cancelled, [reason]); assert.equal(body.locked, false)
})
test('an own header deadline rejects with its exact signal reason even when fetch ignores abort', async () => {
  let attempt
  await assert.rejects(fetchNativePacket(CAREERS_URL, { requestTimeoutMs: 5, fetchImpl: async (_url, options) => { attempt = options.signal; return new Promise(() => {}) } }), error => error === attempt.reason && error.code === 'native_timeout' && error.name === 'TimeoutError')
})
for (const type of ['caller', 'deadline']) test('real streaming body settlement preserves ' + type + ' reason and releases locks', async () => {
  const controller = new AbortController(), reason = new Error('Caller while reading'), cancelled = []
  const body = new ReadableStream({ start(stream) { stream.enqueue(new TextEncoder().encode('first chunk')) }, cancel(value) { cancelled.push(value) } })
  let attempt, result
  const promise = fetchNativePacket(CAREERS_URL, { signal: controller.signal, requestTimeoutMs: type === 'deadline' ? 5 : 1000, fetchImpl: async (_url, options) => { attempt = options.signal; return response(body) } })
  if (type === 'caller') setTimeout(() => controller.abort(reason), 5)
  await assert.rejects(promise, error => { result = error; return error === (type === 'caller' ? reason : attempt.reason) })
  assert.deepEqual(cancelled, [result]); assert.equal(body.locked, false)
})
test('caller wins when both caller and own deadline have fired', async () => {
  const controller = new AbortController(), reason = new Error('Caller priority')
  await assert.rejects(fetchNativePacket(CAREERS_URL, { signal: controller.signal, requestTimeoutMs: 5, fetchImpl: async (_url, options) => {
    options.signal.addEventListener('abort', () => controller.abort(reason), { once: true })
    return new Promise(() => {})
  } }), error => error === reason)
})
test('a body rejection is bounded, is not retried and retains its cause', async () => {
  const reason = new Error('Controlled reader failure'); let calls = 0
  const body = new ReadableStream({ pull(controller) { controller.error(reason) } })
  await assert.rejects(fetchNativePacket(CAREERS_URL, { fetchImpl: async () => { calls++; return response(body) } }), error => error.cause === reason)
  assert.equal(calls, 1); assert.equal(body.locked, false)
})
test('completed work clears its deadline and source-owned abort listeners', async () => {
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout, timers = new Set(), listeners = new Set()
  globalThis.setTimeout = (callback, ms, ...args) => { const timer = realSet(callback, ms, ...args); if (ms === 20000) timers.add(timer); return timer }
  globalThis.clearTimeout = timer => { timers.delete(timer); return realClear(timer) }
  try {
    await fetchNativePacket(CAREERS_URL, { fetchImpl: async (_url, { signal }) => {
      const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal)
      signal.addEventListener = (type, listener, options) => { if (type === 'abort') listeners.add(listener); return add(type, listener, options) }
      signal.removeEventListener = (type, listener, options) => { listeners.delete(listener); return remove(type, listener, options) }
      return response()
    } })
    assert.equal(timers.size, 0); assert.equal(listeners.size, 0)
  } finally { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear }
})
test('numeric or noncanonical injected clock cannot create a capture timestamp', async () => {
  const packet = await fetchNativePacket(CAREERS_URL, { captureClock: () => 1793460000000, fetchImpl: async () => response() })
  assert.equal(packet.startedAt, null); assert.equal(packet.capturedAt, null)
})
test('a throwing injected capture clock still clears the owned deadline', async () => {
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout, timers = new Set(), reason = new Error('Controlled clock failure')
  globalThis.setTimeout = (callback, ms, ...args) => { const timer = realSet(callback, ms, ...args); if (ms === 20000) timers.add(timer); return timer }
  globalThis.clearTimeout = timer => { timers.delete(timer); return realClear(timer) }
  try {
    await assert.rejects(fetchNativePacket(CAREERS_URL, { captureClock() { throw reason }, fetchImpl: async () => response() }))
    assert.equal(timers.size, 0)
  } finally { for (const timer of timers) realClear(timer); globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear }
})
for (const [name, value, declared] of [['short', 'clean short body', 100], ['long', 'clean longer body', 3]]) test('identity body with clean EOF rejects a ' + name + ' Content-Length mismatch', async () => {
  const result = response(value, { headers: { 'content-length': String(declared), 'content-encoding': 'identity' } })
  await assert.rejects(fetchNativePacket(CAREERS_URL, { fetchImpl: async () => result }), /length/i)
  assert.equal(result.body.locked, false)
})
test('an unencoded exact UTF8 byte length is accepted without character-count substitution', async () => {
  const value = 'Career – native text', bytes = Buffer.byteLength(value)
  const packet = await fetchNativePacket(CAREERS_URL, { fetchImpl: async () => response(value, { headers: { 'content-length': String(bytes) } }) })
  assert.equal(packet.body, value); assert.equal(packet.bytes, bytes)
})
test('compressed Content-Length is not compared to already decoded body length', async () => {
  const value = 'A decoded native body that is longer than its compressed representation'
  const packet = await fetchNativePacket(CAREERS_URL, { fetchImpl: async () => response(value, { headers: { 'content-length': '12', 'content-encoding': 'gzip' } }) })
  assert.equal(packet.body, value); assert.equal(packet.bytes, Buffer.byteLength(value))
})
