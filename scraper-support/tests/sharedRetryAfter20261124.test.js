import assert from 'node:assert/strict'
import test from 'node:test'

import { applyRetryPolicyToScraperError } from '../runner.js'
import { buildHttpError, fetchJsonWithRetry } from '../utils/fetch.js'
import { getRetryMetadata, withRetry } from '../utils/retry.js'

const URL = 'https://public-recruitment.example/jobs'
const nativeResponse = (status, headers = {}) => Object.defineProperty(new Response(
  status === 200 ? JSON.stringify({ jobs: [{ id: 'native-42' }] }) : 'Temporarily unavailable',
  { status, headers: { 'content-type': 'application/json', ...headers } },
), 'url', { value: URL })

const runWithPolicy = (operation, options = {}) => withRetry(async () => {
  try {
    return await operation()
  } catch (error) {
    throw applyRetryPolicyToScraperError(error)
  }
}, { attempts: 3, baseDelayMs: 0, label: 'outer-rate-limit', ...options })

test('shared HTTP errors preserve the server Retry-After on service unavailability', () => {
  const error = buildHttpError(nativeResponse(503, { 'retry-after': '2' }), URL)
  assert.equal(error.retryDelayMs, 2000)
  assert.equal(error.status, 503)
  assert.equal(error.requestedUrl, URL)
})

test('shared fetch waits for a service-unavailable Retry-After before recovering', async () => {
  let requests = 0
  const result = await fetchJsonWithRetry(URL, {
    attempts: 2, baseDelayMs: 0, timeoutMs: 0,
    fetchImpl: async () => ++requests === 1
      ? nativeResponse(503, { 'retry-after': '0.04' })
      : nativeResponse(200),
  })

  assert.deepEqual(result.jobs, [{ id: 'native-42' }])
  assert.equal(requests, 2)
  assert.deepEqual(getRetryMetadata(result), { attemptsUsed: 2, retries: 1, retryDelayMs: 40 })
})

test('a source deadline cancels service-unavailable Retry-After with the exact caller reason', async () => {
  const controller = new AbortController()
  const reason = Object.freeze({ sourceDeadline: true })
  let requests = 0
  const deadline = setTimeout(() => controller.abort(reason), 20)
  try {
    await assert.rejects(fetchJsonWithRetry(URL, {
      attempts: 3, baseDelayMs: 0, timeoutMs: 0, signal: controller.signal,
      fetchImpl: async () => {
        requests++
        return nativeResponse(503, { 'retry-after': '60' })
      },
    }), error => error === reason)
    assert.equal(requests, 1)
    assert.deepEqual(reason, { sourceDeadline: true })
  } finally {
    clearTimeout(deadline)
  }
})

test('the runner lets a single-attempt ordinary 429 recover using its server retry hint', async () => {
  let requests = 0
  const result = await runWithPolicy(() => fetchJsonWithRetry(URL, {
    attempts: 1, baseDelayMs: 0, timeoutMs: 0,
    fetchImpl: async () => ++requests === 1
      ? nativeResponse(429, { 'retry-after': '0.04' })
      : nativeResponse(200),
  }))

  assert.deepEqual(result.jobs, [{ id: 'native-42' }])
  assert.equal(requests, 2)
  assert.deepEqual(getRetryMetadata(result), { attemptsUsed: 2, retries: 1, retryDelayMs: 40 })
})

test('the runner bounds ordinary 429 retries to its own attempt budget', async () => {
  let requests = 0
  await assert.rejects(runWithPolicy(() => fetchJsonWithRetry(URL, {
    attempts: 1, baseDelayMs: 0, timeoutMs: 0,
    fetchImpl: async () => {
      requests++
      return nativeResponse(429, { 'retry-after': '0' })
    },
  })), error => {
    assert.equal(error.softFailure, true)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.deepEqual(getRetryMetadata(error), { attemptsUsed: 3, retries: 2, retryDelayMs: 0 })
    return true
  })
  assert.equal(requests, 3)
})

test('exhausted inner throttle retries never multiply the outer scraper budget', async () => {
  let requests = 0
  await assert.rejects(runWithPolicy(() => fetchJsonWithRetry(URL, {
    attempts: 2, baseDelayMs: 0, timeoutMs: 0,
    fetchImpl: async () => {
      requests++
      return nativeResponse(429, { 'retry-after': '0' })
    },
  })), error => {
    assert.equal(error.abortRetries, true)
    assert.deepEqual(getRetryMetadata(error), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
    assert.deepEqual(getRetryMetadata(error.cause), { attemptsUsed: 2, retries: 1, retryDelayMs: 0 })
    return true
  })
  assert.equal(requests, 2)
})

for (const [name, status, headers] of [
  ['Cloudflare challenge', 429, { 'cf-mitigated': 'challenge', 'retry-after': '0' }],
  ['WAF challenge', 503, { 'x-amzn-waf-action': 'challenge', 'retry-after': '0' }],
  ['HTTP 403', 403, { 'retry-after': '0' }],
]) {
  test(`server retry hints never retry an explicit ${name}`, async () => {
    let requests = 0
    await assert.rejects(runWithPolicy(() => fetchJsonWithRetry(URL, {
      attempts: 3, baseDelayMs: 0, timeoutMs: 0,
      fetchImpl: async () => {
        requests++
        return nativeResponse(status, headers)
      },
    })), error => {
      assert.equal(error.abortRetries, true)
      assert.equal(error.status, status)
      return true
    })
    assert.equal(requests, 1)
  })
}

for (const [name, details] of [
  ['missing hint', {}],
  ['null hint', { retryDelayMs: null }],
  ['nonfinite hint', { retryDelayMs: Infinity }],
  ['negative hint', { retryDelayMs: -1 }],
  ['untyped hint', { retryDelayMs: '0' }],
  ['untyped status', { status: '429', retryDelayMs: 0 }],
  ['conflicting HTTP status', { httpStatus: 403, retryDelayMs: 0 }],
  ['conflicting status code', { statusCode: 403, retryDelayMs: 0 }],
  ['conflicting response status', { response: { status: 403 }, retryDelayMs: 0 }],
  ['exhausted inner budget', { retryDelayMs: 0, abortRetries: true }],
  ['nested exhausted inner budget', { retryDelayMs: 0, cause: Object.assign(new Error('Inner request budget exhausted'), { abortRetries: true }) }],
  ['nested challenge marker', { retryDelayMs: 0, cause: Object.assign(new Error('Remote challenge'), { accessChallenge: true }) }],
  ['nested challenge message', { retryDelayMs: 0, cause: new Error('CAPTCHA: verify you are human') }],
  ['nested permission denial', { retryDelayMs: 0, cause: Object.assign(new Error('Permission denied'), { code: 'EACCES' }) }],
]) {
  test(`the runner retains the stop policy for a 429 with ${name}`, async () => {
    let attempts = 0
    const sourceError = Object.assign(new Error('HTTP 429 for ' + URL), { status: 429, ...details })
    await assert.rejects(runWithPolicy(() => {
      attempts++
      throw sourceError
    }), error => {
      assert.equal(error.abortRetries, true)
      return true
    })
    assert.equal(attempts, 1)
  })
}

test('the outer throttle backoff preserves caller cancellation', async () => {
  const controller = new AbortController()
  const reason = Object.freeze({ outerDeadline: true })
  let requests = 0
  const deadline = setTimeout(() => controller.abort(reason), 20)
  try {
    await assert.rejects(runWithPolicy(() => fetchJsonWithRetry(URL, {
      attempts: 1, timeoutMs: 0, signal: controller.signal,
      fetchImpl: async () => {
        requests++
        return nativeResponse(429, { 'retry-after': '60' })
      },
    }), { signal: controller.signal }), error => error === reason)
    assert.equal(requests, 1)
  } finally {
    clearTimeout(deadline)
  }
})
