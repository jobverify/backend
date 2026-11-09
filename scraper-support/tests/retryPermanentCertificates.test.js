import assert from 'node:assert/strict'
import test from 'node:test'

import { getRetryMetadata, withRetry } from '../utils/retry.js'

// Repeating a request cannot repair an expired, untrusted, or wrong-host certificate.
// The operation must fail closed once, while retaining its original diagnostic cause.
for (const code of [
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]) {
  test(`withRetry stops after one native certificate failure: ${code}`, async () => {
    const certificateError = Object.freeze(Object.assign(new Error('certificate validation failed'), { code }))
    const transportError = Object.freeze(new TypeError('fetch failed', { cause: certificateError }))
    let calls = 0

    await assert.rejects(withRetry(() => {
      calls += 1
      throw transportError
    }, { attempts: 4, baseDelayMs: 0, label: 'permanent-certificate' }), (error) => {
      assert.equal(error.cause, transportError)
      assert.equal(error.cause.cause, certificateError)
      assert.equal(error.code, code)
      assert.equal(error.abortRetries, true)
      assert.deepEqual(getRetryMetadata(error), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
      return true
    })

    assert.equal(calls, 1)
  })
}

test('withRetry detects a permanent certificate code through nested wrapper causes', async () => {
  const certificateError = Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' })
  const fetchError = new TypeError('fetch failed', { cause: certificateError })
  const sourceError = new Error('first-party careers request failed', { cause: fetchError })
  let calls = 0

  await assert.rejects(withRetry(() => {
    calls += 1
    throw sourceError
  }, { attempts: 4, baseDelayMs: 0, label: 'nested-certificate' }), (error) => {
    assert.equal(error.cause, sourceError)
    assert.equal(error.code, 'CERT_HAS_EXPIRED')
    assert.equal(error.abortRetries, true)
    assert.equal(getRetryMetadata(error).attemptsUsed, 1)
    return true
  })

  assert.equal(calls, 1)
})

// Generic fetch failures and TLS alerts can be temporary; certificate policy must
// not stop their existing retry/recovery behavior.
for (const code of [
  undefined,
  'ETIMEDOUT',
  'ECONNRESET',
  'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE',
  'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR',
]) {
  test(`withRetry still recovers after a transient transport failure: ${code || 'fetch failed'}`, async () => {
    const cause = Object.assign(new Error('temporary TLS/network failure'), code ? { code } : {})
    const transportError = new TypeError('fetch failed', { cause })
    let calls = 0

    const result = await withRetry(() => {
      calls += 1
      if (calls === 1) throw transportError
      return ['recovered']
    }, { attempts: 2, baseDelayMs: 0, label: 'transient-transport' })

    assert.deepEqual(result, ['recovered'])
    assert.equal(calls, 2)
    assert.deepEqual(getRetryMetadata(result), { attemptsUsed: 2, retries: 1, retryDelayMs: 0 })
  })
}

test('withRetry terminates cause traversal safely for a cyclic transient error', async () => {
  const cyclicError = new TypeError('fetch failed')
  cyclicError.cause = cyclicError
  let calls = 0

  const result = await withRetry(() => {
    calls += 1
    if (calls === 1) throw cyclicError
    return ['recovered']
  }, { attempts: 2, baseDelayMs: 0, label: 'cyclic-transport' })

  assert.deepEqual(result, ['recovered'])
  assert.equal(calls, 2)
})
