import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../utils/fetch.js'
import { getRetryPressure, withRetry } from '../utils/retry.js'

const url = 'https://controlled.example.invalid/temporary-dns'
const readers = [
  ['text', fetchTextWithRetry, 'Recovered native response'],
  ['json', fetchJsonWithRetry, { jobs: [{ id: 'recovered' }] }],
]
const response = (kind, value) => new Response(kind === 'text' ? value : JSON.stringify(value), {
  status: 200,
  headers: { 'content-type': kind === 'text' ? 'text/html; charset=utf-8' : 'application/json' },
})
const temporaryError = representation => new TypeError('fetch failed', {
  cause: representation === 'code-only'
    ? Object.assign(new Error('temporary name resolution failure'), { code: 'EAI_AGAIN' })
    : new Error('getaddrinfo EAI_AGAIN controlled.example.invalid'),
})

// Putting either EAI_AGAIN's code or its diagnostic text back in the permanent
// classifier would discard the successful second response in these controls.
for (const [kind, read, value] of readers) for (const representation of ['code-only', 'message-only']) {
  test(`shared ${kind} recovers from EAI_AGAIN ${representation} before its attempt limit`, async t => {
    t.mock.method(console, 'warn', () => {})
    const transportError = temporaryError(representation)
    let requests = 0
    const result = await read(url, {
      attempts: 3, baseDelayMs: 1, timeoutMs: 0,
      fetchImpl: async requestedUrl => {
        assert.equal(requestedUrl, url)
        requests++
        if (requests === 1) throw transportError
        return response(kind, value)
      },
    })
    assert.deepEqual(result, value)
    assert.equal(requests, 2, 'Recovery must use the next shared attempt')
    assert.equal(Object.hasOwn(transportError, 'abortRetries'), false,
      'A temporary DNS failure must not be marked permanent')
  })
}

const opaqueReason = () => {
  let reads = 0
  const reason = Object.create(null)
  const sentinel = new Error('Caller cancellation reason must remain opaque')
  for (const key of ['message', 'name', 'code', 'cause', 'abortRetries', 'retryDelayMs', 'toString', 'valueOf', Symbol.toPrimitive]) {
    Object.defineProperty(reason, key, { enumerable: true, get() { reads++; throw sentinel } })
  }
  return { reason: Object.freeze(reason), reads: () => reads, keys: Reflect.ownKeys(reason) }
}

// Retrying EAI_AGAIN opens a backoff window. Cancellation must clear that wait,
// retain the exact opaque caller reason, and prevent another inner/outer call.
for (const [kind, read] of readers) {
  test(`shared ${kind} EAI_AGAIN backoff yields to opaque outer-budget cancellation`, async t => {
    t.mock.method(console, 'warn', () => {})
    const input = opaqueReason(), caller = new AbortController()
    let requests = 0, cancelHandle, watchdog
    const operation = withRetry(() => read(url, {
      attempts: 3, baseDelayMs: 1000, timeoutMs: 0, signal: caller.signal,
      fetchImpl: async () => {
        requests++
        if (requests === 1) cancelHandle = setImmediate(() => caller.abort(input.reason))
        throw temporaryError('code-only')
      },
    }), { attempts: 2, baseDelayMs: 0, signal: caller.signal })
    const rejection = operation.then(value => ({ rejected: false, value }), reason => ({ rejected: true, reason }))
    try {
      const outcome = await Promise.race([
        rejection,
        new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('DNS backoff ignored caller cancellation')), 500) }),
      ])
      assert.equal(outcome.rejected, true)
      assert.equal(Object.is(outcome.reason, input.reason), true, 'Outer-budget cancellation must preserve caller identity')
      assert.equal(requests, 1, 'Cancellation must prevent all subsequent transport attempts')
      assert.equal(input.reads(), 0, 'Cancellation must not inspect or coerce the caller reason')
      assert.deepEqual(Reflect.ownKeys(input.reason), input.keys)
      assert.equal(Object.isFrozen(input.reason), true)
      const pressure = getRetryPressure(operation)
      assert.equal(pressure.nestedAttempts, 1)
      assert.equal(pressure.nestedRetries, 0)
      assert.equal(pressure.nestedFailedAttempts, 1)
      assert.equal(pressure.nestedRetryDelayMs, 1000)
      assert.deepEqual(pressure.httpStatusCounts, {})
    } finally {
      clearImmediate(cancelHandle)
      clearTimeout(watchdog)
      if (!caller.signal.aborted) caller.abort(input.reason)
    }
  })
}
