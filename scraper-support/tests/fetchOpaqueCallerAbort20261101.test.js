import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchTextWithRetry, fetchJsonWithRetry } from '../utils/fetch.js'
import { withRetry, getRetryPressure } from '../utils/retry.js'

const url = 'https://native.example.invalid/controlled'
const rejection = promise => promise.then(value => ({ rejected: false, value }), reason => ({ rejected: true, reason }))
const opaque = () => {
  let reads = 0
  const reason = Object.create(null), marker = Object.freeze(new Error('Caller reason properties must remain opaque'))
  for (const key of ['message', 'name', 'code', 'cause', 'abortRetries', 'retryDelayMs', 'toString', 'valueOf', Symbol.toPrimitive]) {
    Object.defineProperty(reason, key, { enumerable: true, get() { reads++; throw marker } })
  }
  Object.freeze(reason)
  return { reason, reads: () => reads, keys: Reflect.ownKeys(reason) }
}
const reasons = [['zero', () => ({ reason: 0 })], ['null', () => ({ reason: null })], ['false', () => ({ reason: false })], ['opaque-accessors', opaque]]
const kinds = [['text', fetchTextWithRetry, 'Controlled native body'], ['json', fetchJsonWithRetry, { records: [] }]]
const response = (kind, body) => ({ ok: true, status: 200, url, headers: new Headers({ 'content-type': kind === 'text' ? 'text/html' : 'application/json' }), text: body, json: body })
const exact = (outcome, input) => {
  assert.equal(outcome.rejected, true)
  assert.equal(Object.is(outcome.reason, input.reason), true, 'Caller reason identity must survive without wrapping/coercion')
  if (input.reads) { assert.equal(input.reads(), 0, 'No caller reason accessor or coercion may run'); assert.deepEqual(Reflect.ownKeys(input.reason), input.keys); assert.equal(Object.isFrozen(input.reason), true) }
}

for (const [kind, read, value] of kinds) for (const [name, reason] of reasons) {
  for (const stage of ['preabort', 'headers-fulfilled', 'headers-rejected', 'body-fulfilled', 'body-rejected']) test('shared ' + kind + ' exact opaque caller ' + name + ' at ' + stage, async t => {
    const input = reason(), caller = new AbortController()
    let requests = 0, bodies = 0
    const transport = async () => {
      requests++
      if (stage.startsWith('headers')) caller.abort(input.reason)
      if (stage === 'headers-rejected') throw new Error('Controlled replacement header failure')
      return response(kind, async () => {
        bodies++
        caller.abort(input.reason)
        if (stage === 'body-rejected') throw new Error('Controlled replacement body failure')
        return value
      })
    }
    if (stage === 'preabort') caller.abort(input.reason)
    // Exercise the default global HTTP boundary for headers; other stages use
    // the documented injected transport. Neither boundary makes native IO.
    if (stage === 'headers-fulfilled') t.mock.method(globalThis, 'fetch', transport)
    const outcome = await rejection(read(url, { signal: caller.signal, attempts: 3, baseDelayMs: 0, timeoutMs: 0,
      ...(stage === 'headers-fulfilled' ? {} : { fetchImpl: transport }) }))
    exact(outcome, input)
    assert.equal(requests, stage === 'preabort' ? 0 : 1)
    assert.equal(bodies, stage.startsWith('body') ? 1 : 0)
  })
}

for (const [name, reason] of reasons) for (const stage of ['preabort', 'inflight']) test('direct retry already preserves opaque ' + name + ' reason at ' + stage, async () => {
  const input = reason(), caller = new AbortController()
  let attempts = 0
  if (stage === 'preabort') caller.abort(input.reason)
  const operation = withRetry(async () => { attempts++; caller.abort(input.reason); throw new Error('Controlled replaced operation error') }, { signal: caller.signal, attempts: 3, baseDelayMs: 0 })
  exact(await rejection(operation), input)
  assert.equal(attempts, stage === 'preabort' ? 0 : 1)
})

for (const [kind, read] of kinds) for (const [name, value] of [['zero', 0], ['null', null], ['false', false]]) test('shared ' + kind + ' keeps late ' + name + ' caller priority before settlement', async t => {
  t.mock.method(console, 'warn', () => {})
  const caller = new AbortController()
  let requests = 0
  const operation = read(url, { signal: caller.signal, attempts: 1, timeoutMs: 0, fetchImpl: async () => {
    requests++
    // Abort after the inner retry catch but before this exported helper settles.
    // This is an ordinary cooperative promise/microtask boundary, not body IO.
    queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => caller.abort(value))))
    throw new Error('Controlled ordinary transport failure before caller abort')
  } })
  const outcome = await rejection(operation)
  assert.equal(caller.signal.aborted, true)
  exact(outcome, { reason: value }); assert.equal(requests, 1)
})

for (const [kind, read, value] of kinds) test('shared ' + kind + ' ordinary success and noncaller retry behavior stay intact', async t => {
  t.mock.method(console, 'warn', () => {})
  let requests = 0, bodies = 0
  const operation = withRetry(() => read(url, { attempts: 2, baseDelayMs: 0, timeoutMs: 0, fetchImpl: async () => {
    if (++requests === 1) throw new Error('Controlled transient noncaller failure')
    return response(kind, async () => { bodies++; return value })
  } }), { attempts: 1 })
  assert.deepEqual(await operation, value)
  assert.equal(requests, 2); assert.equal(bodies, 1)
  const pressure = getRetryPressure(operation)
  assert.equal(pressure.nestedAttempts, 2); assert.equal(pressure.nestedRetries, 1)
  assert.equal(pressure.nestedFailedAttempts, 1); assert.equal(pressure.nestedRetryDelayMs, 0)
  assert.deepEqual(pressure.httpStatusCounts, {})
})

for (const [kind, read] of kinds) test('shared ' + kind + ' own timeout reason remains a noncaller failure', async t => {
  t.mock.method(console, 'warn', () => {})
  const deadline = new AbortController(), reason = Object.freeze(new DOMException('Controlled own timeout', 'TimeoutError'))
  let requests = 0, bodies = 0
  t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
  const outcome = await rejection(read(url, { attempts: 1, fetchImpl: async () => {
    requests++; deadline.abort(reason)
    return response(kind, async () => { bodies++; return kind === 'text' ? 'unused' : {} })
  } }))
  assert.equal(outcome.rejected, true)
  assert.ok(outcome.reason === reason || outcome.reason.cause === reason)
  assert.equal(requests, 1); assert.equal(bodies, 0)
})

test('shared Retry-After cancellation preserves every raw caller reason, pressure and one request', async t => {
  t.mock.method(console, 'warn', () => {})
  for (const [, reason] of reasons) {
    const input = reason(), caller = new AbortController()
    let requests = 0, timer
    const operation = withRetry(() => fetchJsonWithRetry(url, { attempts: 3, baseDelayMs: 0, timeoutMs: 0, signal: caller.signal,
      fetchImpl: async () => {
        requests++
        timer = setTimeout(() => caller.abort(input.reason), 5)
        return { ok: false, status: 429, headers: new Headers({ 'retry-after': '0.05' }) }
      } }), { attempts: 1, signal: caller.signal })
    try {
      exact(await rejection(operation), input)
      assert.equal(requests, 1)
      const pressure = getRetryPressure(operation)
      assert.equal(pressure.nestedAttempts, 1); assert.equal(pressure.nestedRetries, 0)
      assert.equal(pressure.nestedRetryDelayMs, 50)
      assert.deepEqual(pressure.httpStatusCounts, { 429: 1 })
    } finally { clearTimeout(timer) }
  }
})
