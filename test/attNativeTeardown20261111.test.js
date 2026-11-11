// Authored EventEmitter lifecycle models only; no sockets, TLS handshakes,
// native job responses or physical teardown completion are measured here.
import assert from 'node:assert/strict'
import { EventEmitter, getEventListeners } from 'node:events'
import { setImmediate as nextTurn } from 'node:timers/promises'
import test from 'node:test'
import { getAttNative as requestNative } from '../scraper/att.workday/nativeHttp.js'
const getAttNative = (url, options) => requestNative(url, { timeoutMs: 1000, ...options })
const url = 'https://www.att.jobs/job/hyderabad/authored-teardown-control/117/123456789'
const reasonFactories = [['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen', () => Object.freeze(Error('Authored caller reason'))], ['native', () => AbortSignal.abort().reason],
  ['object', () => Object.freeze({ opaque: 'authored caller token' })], ['symbol', () => Symbol('authored caller')]]
const primaryFactories = [['undefined', () => undefined], ...reasonFactories.filter(([kind]) => kind !== 'native')]
const snapshot = value => value && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
const timers = () => process.getActiveResourcesInfo().filter(kind => kind === 'Timeout').length
const outcomeOf = promise => {
  let timer
  const observed = promise.then(value => ({ success: true, value }), value => ({ success: false, value }))
  // A stalled preimage is a failed assertion, rather than a hung test process.
  const stalled = new Promise(resolve => { timer = setTimeout(() => resolve({ success: false, value: Symbol('source failed to settle') }), 200) })
  return Promise.race([observed, stalled]).finally(() => clearTimeout(timer))
}
const assertReason = (outcome, reason, before) => { assert.equal(outcome.success, false); assert.ok(Object.is(outcome.value, reason)); assert.deepEqual(snapshot(reason), before) }
const handle = (throwDestroy = false) => {
  const value = new EventEmitter()
  value.destroyCalls = 0; value.endCalls = 0
  value.destroy = () => { value.destroyCalls++; if (throwDestroy) throw Error('Authored cleanup failure') }
  value.end = () => { value.endCalls++ }
  return value
}
const incoming = (throwDestroy = false) => Object.assign(handle(throwDestroy), { statusCode: 200, headers: { 'content-type': 'text/html' } })
const lateErrorRouting = value => {
  // Explicit manual emitter routing, not a claim about real orphan sockets.
  for (let n = 0; n < 2; n++) assert.doesNotThrow(() => value.emit('error', Error('Authored late handle error')))
}
const noBodyAdmission = value => {
  for (const event of ['data', 'end', 'aborted']) assert.equal(value.listenerCount(event), 0)
}
const finished = async (caller, count) => { await nextTurn(); assert.equal(getEventListeners(caller.signal, 'abort').length, 0); assert.ok(timers() <= count, 'Attempt timers must be released') }

for (const [kind, makeReason] of reasonFactories) {
  test(`AT&T pre-aborted ${kind} never constructs a handle`, async () => {
    const caller = new AbortController(), reason = makeReason(), before = snapshot(reason), count = timers()
    caller.abort(reason)
    let calls = 0
    const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl() { calls++; throw Error('Must not construct') } }))
    assertReason(result, reason, before); assert.equal(calls, 0); await finished(caller, count)
  })
  for (const throws of [false, true]) test(`AT&T constructor abort ${kind} disposes late request once with cleanupThrows=${throws}`, async () => {
    const caller = new AbortController(), reason = makeReason(), before = snapshot(reason), count = timers(), request = handle(throws)
    let passedSignal, calls = 0
    const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl(_url, options) {
      passedSignal = options.signal; calls++; caller.abort(reason); return request
    } }))
    assertReason(result, reason, before)
    assert.ok(Object.is(passedSignal.reason, reason)); assert.equal(calls, 1)
    assert.equal(request.endCalls, 0); assert.equal(request.destroyCalls, 1)
    lateErrorRouting(request); await finished(caller, count)
  })
  for (const throws of [false, true]) test(`AT&T late incoming after abort ${kind} is disposed once with cleanupThrows=${throws}`, async () => {
    const caller = new AbortController(), reason = makeReason(), before = snapshot(reason), count = timers(), request = handle(), response = incoming(throws)
    let onResponse, metadataReads = 0
    Object.defineProperty(response, 'statusCode', { get() { metadataReads++; return 200 } })
    const pending = outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl(_url, _options, callback) { onResponse = callback; return request } }))
    caller.abort(reason); assertReason(await pending, reason, before)
    assert.doesNotThrow(() => { onResponse(response); onResponse(response) })
    assert.equal(request.destroyCalls, 1); assert.equal(response.destroyCalls, 1)
    assert.equal(metadataReads, 0); noBodyAdmission(response)
    lateErrorRouting(request); lateErrorRouting(response); await finished(caller, count)
  })
  test(`AT&T synchronous incoming after constructor abort ${kind} is not admitted`, async () => {
    const caller = new AbortController(), reason = makeReason(), before = snapshot(reason), count = timers(), request = handle(), response = incoming()
    const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl(_url, _options, callback) { caller.abort(reason); callback(response); return request } }))
    assertReason(result, reason, before); assert.equal(request.endCalls, 0)
    assert.equal(request.destroyCalls, 1); assert.equal(response.destroyCalls, 1); noBodyAdmission(response)
    lateErrorRouting(request); lateErrorRouting(response); await finished(caller, count)
  })
  test(`AT&T cancellation ${kind} during error listener registration prevents request end`, async () => {
    const caller = new AbortController(), reason = makeReason(), before = snapshot(reason), count = timers(), request = handle()
    request.once('newListener', event => { if (event === 'error') caller.abort(reason) })
    const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl() { return request } }))
    assertReason(result, reason, before); assert.equal(request.endCalls, 0); assert.equal(request.destroyCalls, 1)
    lateErrorRouting(request); await finished(caller, count)
  })
}

for (const [kind, makePrimary] of primaryFactories) for (const stage of ['request-only', 'response', 'both', 'ordinary']) test(`AT&T ${stage} teardown retains uncancelled ${kind} primary`, async () => {
  const caller = new AbortController(), primary = makePrimary(), before = snapshot(primary), count = timers()
  const request = handle(stage === 'request-only' || stage === 'both'), response = incoming(stage === 'response' || stage === 'both')
  request.end = () => { request.endCalls++; if (stage !== 'request-only') onResponse(response); throw primary }
  let onResponse, calls = 0
  const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl(_url, _options, callback) { calls++; onResponse = callback; return request } }))
  assertReason(result, primary, before); assert.equal(calls, 1); assert.equal(request.destroyCalls, 1)
  assert.equal(response.destroyCalls, stage === 'request-only' ? 0 : 1)
  lateErrorRouting(request); if (stage !== 'request-only') lateErrorRouting(response)
  await finished(caller, count)
})

for (const status of [202, 301, 401, 403, 429, 451, 500]) for (const throws of [false, true]) test(`AT&T synchronous HTTP ${status} teardown preserves denial with cleanupThrows=${throws}`, async () => {
  const count = timers(), caller = new AbortController(), request = handle(throws), response = incoming(throws)
  response.statusCode = status
  const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl(_url, _options, callback) { callback(response); return request } }))
  assert.equal(result.success, false); assert.equal(result.value.status, status); assert.equal(result.value.requestUrl, url)
  assert.equal(Boolean(result.value.abortRetries), [202, 401, 403, 429, 451].includes(status))
  assert.equal(request.endCalls, 0); assert.equal(request.destroyCalls, 1); assert.equal(response.destroyCalls, 1)
  noBodyAdmission(response); lateErrorRouting(request); lateErrorRouting(response); await finished(caller, count)
})

for (const mime of [null, 'image/png']) test(`AT&T invalid MIME ${mime} is rejected before body admission`, async () => {
  const count = timers(), caller = new AbortController(), request = handle(true), response = incoming(true)
  response.headers['content-type'] = mime
  const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl(_url, _options, callback) { callback(response); return request } }))
  assert.equal(result.success, false); assert.match(result.value.message, /body MIME unavailable/)
  assert.equal(request.endCalls, 0); assert.equal(request.destroyCalls, 1); assert.equal(response.destroyCalls, 1)
  noBodyAdmission(response); lateErrorRouting(request); lateErrorRouting(response); await finished(caller, count)
})
for (const [label, body, expected] of [['empty', Buffer.from('  '), /body empty/], ['invalid UTF8', Buffer.from([0xff]), /invalid UTF-8/], ['oversize', Buffer.alloc(2097153), /exceeds 2MiB/]]) test(`AT&T preserves ${label} body rejection during throwing teardown`, async () => {
  const count = timers(), caller = new AbortController(), request = handle(true), response = incoming(true)
  let callback
  request.end = () => { callback(response); response.emit('data', body); response.emit('end') }
  const result = await outcomeOf(getAttNative(url, { signal: caller.signal, requestImpl(_url, _options, onResponse) { callback = onResponse; return request } }))
  assert.equal(result.success, false); assert.match(result.value.message, expected)
  assert.equal(request.destroyCalls, 1); assert.equal(response.destroyCalls, 1)
  lateErrorRouting(request); lateErrorRouting(response); await finished(caller, count)
})
test('AT&T successful response keeps its exact shape and disposes only an additional late response', async () => {
  const count = timers(), caller = new AbortController(), request = handle(), response = incoming(), extra = incoming(true)
  let callback, init
  request.end = () => { callback(response); response.emit('data', Buffer.from('Authored transport text')); response.emit('end') }
  const result = await getAttNative(url, { signal: caller.signal, requestImpl(requestUrl, options, onResponse) { assert.equal(requestUrl, url); init = options; callback = onResponse; return request } })
  assert.deepEqual(result, { body: 'Authored transport text', url, status: 200, contentType: 'text/html' })
  assert.equal(init.method, 'GET'); assert.equal(init.maxHeaderSize, 65536); assert.equal(init.rejectUnauthorized, undefined)
  assert.equal(request.destroyCalls, 0); assert.equal(response.destroyCalls, 0)
  callback(extra); callback(extra); assert.equal(extra.destroyCalls, 1); noBodyAdmission(extra); lateErrorRouting(extra)
  await finished(caller, count)
})
test('AT&T request deadline disposes its owned request and retains timeout error', async () => {
  const count = timers(), caller = new AbortController(), request = handle()
  const result = await outcomeOf(getAttNative(url, { signal: caller.signal, timeoutMs: 10, requestImpl() { return request } }))
  assert.equal(result.success, false); assert.match(result.value.message, /Request timeout/)
  assert.equal(request.destroyCalls, 1); lateErrorRouting(request); await finished(caller, count)
})
for (const timeoutMs of [0, -1, 20001, 1.5, NaN]) test(`AT&T keeps invalid timeout ${timeoutMs} outside request admission`, async () => {
  let calls = 0
  const result = await outcomeOf(getAttNative(url, { timeoutMs, requestImpl() { calls++ } }))
  assert.equal(result.success, false); assert.match(result.value.message, /Invalid request timeout bound/); assert.equal(calls, 0)
})
