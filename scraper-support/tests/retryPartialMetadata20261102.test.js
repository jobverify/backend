import assert from 'node:assert/strict'
import test from 'node:test'
import { withRetry, getRetryMetadata } from '../utils/retry.js'

const rejected = promise => promise.then(value => ({ rejected: false, value }), error => ({ rejected: true, error }))
const opaque = () => {
  let reads = 0
  const reason = Object.create(null)
  for (const name of ['message', 'name', 'code', 'cause', 'partial', 'abortRetries', 'toString', Symbol.toPrimitive]) {
    Object.defineProperty(reason, name, { get() { reads++; throw Error('Caller reasons must remain opaque') } })
  }
  return { reason: Object.freeze(reason), reads: () => reads }
}

test('retry metadata retains literal source partial through a terminal wrapper without changing cause or attempt telemetry', async () => {
  const sourceError = Object.assign(new Error('controlled unavailable role'), { partial: true, abortRetries: true, softFailure: true, failureKind: 'native_role_unavailable' })
  let attempts = 0
  const result = await rejected(withRetry(async () => { attempts++; throw sourceError }, { attempts: 3, baseDelayMs: 0, label: 'partial-terminal' }))
  assert.equal(result.rejected, true)
  assert.notEqual(result.error, sourceError)
  assert.equal(result.error.cause, sourceError)
  assert.equal(result.error.partial, true)
  assert.equal(result.error.cause.partial, true)
  assert.equal(result.error.abortRetries, true)
  assert.equal(result.error.failureKind, 'native_role_unavailable')
  assert.equal(attempts, 1)
  assert.deepEqual(getRetryMetadata(result.error), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
})

test('retry metadata retains source partial after exhausted attempts and preserves the final cause and zero-delay budget', async () => {
  const failures = []
  const result = await rejected(withRetry(async () => {
    const error = Object.assign(new Error('controlled attempt ' + failures.length), { partial: true })
    failures.push(error); throw error
  }, { attempts: 2, baseDelayMs: 0, label: 'partial-exhausted' }))
  assert.equal(result.rejected, true)
  assert.equal(failures.length, 2)
  assert.equal(result.error.cause, failures[1])
  assert.equal(result.error.partial, true)
  assert.equal(result.error.abortRetries, undefined)
  assert.deepEqual(getRetryMetadata(result.error), { attemptsUsed: 2, retries: 1, retryDelayMs: 0 })
})

test('retry partial metadata preserves false and nonboolean values without coercing them to literal true', async () => {
  for (const value of [false, 'true', 1]) {
    const error = Object.assign(new Error('controlled value'), { partial: value, abortRetries: true })
    const result = await rejected(withRetry(async () => { throw error }, { attempts: 2, baseDelayMs: 0 }))
    assert.equal(result.error.cause, error)
    assert.equal(result.error.partial, value)
    assert.notEqual(result.error.partial, true)
  }
})

test('retry partial metadata does not invent a field when source partial is missing, undefined or null', async () => {
  for (const fields of [{}, { partial: undefined }, { partial: null }]) {
    const error = Object.assign(new Error('controlled unknown partial'), { abortRetries: true }, fields)
    const result = await rejected(withRetry(async () => { throw error }, { attempts: 1, baseDelayMs: 0 }))
    assert.equal(Object.hasOwn(result.error, 'partial'), false)
    assert.equal(result.error.cause, error)
  }
})

test('retry partial metadata leaves ordinary successful result identity and telemetry unchanged', async () => {
  const value = { roles: ['controlled'] }
  const result = await withRetry(async () => value, { attempts: 2, baseDelayMs: 0 })
  assert.equal(result, value)
  assert.equal(Object.hasOwn(result, 'partial'), false)
  assert.deepEqual(getRetryMetadata(result), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
})

test('retry partial metadata never reads or wraps pre-aborted null, zero or opaque caller reasons', async () => {
  for (const input of [{ reason: null }, { reason: 0 }, opaque()]) {
    const caller = new AbortController(); caller.abort(input.reason)
    let attempts = 0
    const result = await rejected(withRetry(async () => { attempts++; throw Error('must not run') }, { attempts: 3, baseDelayMs: 0, signal: caller.signal }))
    assert.equal(result.rejected, true)
    assert.equal(result.error, input.reason)
    assert.equal(attempts, 0)
    if (input.reads) assert.equal(input.reads(), 0)
  }
})

test('retry partial metadata preserves exact caller reasons over in-flight replacement errors and prevents another attempt', async () => {
  for (const input of [{ reason: null }, { reason: 0 }, opaque()]) {
    const caller = new AbortController()
    let attempts = 0
    const result = await rejected(withRetry(async () => {
      attempts++
      caller.abort(input.reason)
      throw Object.assign(new Error('replacement transport error'), { partial: true })
    }, { attempts: 3, baseDelayMs: 0, signal: caller.signal }))
    assert.equal(result.error, input.reason)
    assert.equal(attempts, 1)
    if (input.reads) assert.equal(input.reads(), 0)
  }
})

test('retry partial metadata leaves cancellable backoff and exact caller reasons unchanged', async () => {
  for (const input of [{ reason: null }, { reason: 0 }, opaque()]) {
    const caller = new AbortController()
    let attempts = 0
    const operation = withRetry(async () => {
      attempts++
      setTimeout(() => caller.abort(input.reason), 0)
      throw Object.assign(new Error('controlled backoff'), { partial: true })
    }, { attempts: 3, baseDelayMs: 10000, signal: caller.signal })
    const result = await rejected(operation)
    assert.equal(result.error, input.reason)
    assert.equal(attempts, 1)
    if (input.reads) assert.equal(input.reads(), 0)
  }
})

test('retry partial metadata preserves permanent TLS failure terminal behavior and the original cause', async () => {
  const error = Object.assign(new Error('controlled expired certificate'), { code: 'CERT_HAS_EXPIRED', partial: true })
  let attempts = 0
  const result = await rejected(withRetry(async () => { attempts++; throw error }, { attempts: 3, baseDelayMs: 0 }))
  assert.equal(result.error.cause, error)
  assert.equal(result.error.code, 'CERT_HAS_EXPIRED')
  assert.equal(result.error.partial, true)
  assert.equal(result.error.abortRetries, true)
  assert.equal(attempts, 1)
  assert.deepEqual(getRetryMetadata(result.error), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
})
