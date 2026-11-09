import assert from 'node:assert/strict'
import test from 'node:test'
import * as retry from '../utils/retry.js'
import { fetchJsonWithRetry } from '../utils/fetch.js'

const response = (status, payload = []) => ({
  ok: status === 200,
  status,
  headers: { get: () => null },
  json: async () => payload,
})

test('source telemetry retains recovered request retries and HTTP 429 responses', async () => {
  let calls = 0
  const jobs = await retry.withRetry(async () => {
    await fetchJsonWithRetry('https://employer.invalid/jobs', {
      attempts: 2, baseDelayMs: 0, label: 'native-listing',
      fetchImpl: async () => response(++calls === 1 ? 429 : 200),
    })
    await fetchJsonWithRetry('https://employer.invalid/details', {
      attempts: 1, baseDelayMs: 0, label: 'native-detail',
      fetchImpl: async () => response(200),
    })
    return []
  }, { attempts: 2, baseDelayMs: 0, label: 'source' })

  assert.equal(calls, 2)
  assert.deepEqual(retry.getRetryMetadata(jobs), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
  assert.deepEqual(retry.getRetryPressure?.(jobs), {
    nestedScopes: 2, nestedAttempts: 3, nestedRetries: 1, nestedFailedAttempts: 1,
    nestedRetryDelayMs: 0, httpStatusCounts: { 429: 1 },
  })
})

test('source telemetry retains failed inner attempts without multiplying an exhausted request budget', async () => {
  let calls = 0
  await assert.rejects(retry.withRetry(async () => {
    return fetchJsonWithRetry('https://employer.invalid/jobs', {
      attempts: 2, baseDelayMs: 0, label: 'unavailable-listing',
      fetchImpl: async () => { calls++; return response(503) },
    })
  }, { attempts: 2, baseDelayMs: 0, label: 'failed-source' }), error => {
    assert.deepEqual(retry.getRetryMetadata(error), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
    assert.deepEqual(retry.getRetryPressure?.(error), {
      nestedScopes: 1, nestedAttempts: 2, nestedRetries: 1, nestedFailedAttempts: 2,
      nestedRetryDelayMs: 0, httpStatusCounts: { 503: 2 },
    })
    return true
  })
  assert.equal(calls, 2)
})

test('source restarts retain recovered request pressure from previous source attempts', async () => {
  let sourceAttempts = 0, requests = 0
  const jobs = await retry.withRetry(async () => {
    sourceAttempts++
    await fetchJsonWithRetry('https://employer.invalid/jobs', {
      attempts: 2, baseDelayMs: 0, label: 'restart-listing',
      fetchImpl: async () => response(++requests === 1 ? 429 : 200),
    })
    if (sourceAttempts === 1) throw new Error('temporary source assembly failure')
    return []
  }, { attempts: 2, baseDelayMs: 0, label: 'restarted-source' })
  assert.deepEqual(retry.getRetryMetadata(jobs), { attemptsUsed: 2, retries: 1, retryDelayMs: 0 })
  assert.deepEqual(retry.getRetryPressure?.(jobs), {
    nestedScopes: 2, nestedAttempts: 3, nestedRetries: 1, nestedFailedAttempts: 1,
    nestedRetryDelayMs: 0, httpStatusCounts: { 429: 1 },
  })
})

test('concurrent sources do not mix native HTTP retry diagnostics', async () => {
  const source = (label, status) => retry.withRetry(async () => {
    let calls = 0
    await fetchJsonWithRetry(`https://${label}.invalid/jobs`, {
      attempts: 2, baseDelayMs: 0, label,
      fetchImpl: async () => response(++calls === 1 ? status : 200),
    })
    return []
  }, { attempts: 1, baseDelayMs: 0, label })
  const [rateLimited, unavailable] = await Promise.all([source('alpha', 429), source('beta', 503)])
  assert.deepEqual(retry.getRetryPressure?.(rateLimited)?.httpStatusCounts, { 429: 1 })
  assert.deepEqual(retry.getRetryPressure?.(unavailable)?.httpStatusCounts, { 503: 1 })
})

test('abort preserves request pressure without restarting the cancelled source', async () => {
  const controller = new AbortController()
  const reason = new Error('source cancelled')
  let calls = 0
  await assert.rejects(retry.withRetry(async () => {
    return fetchJsonWithRetry('https://employer.invalid/jobs', {
      attempts: 3, baseDelayMs: 0, label: 'cancelled-listing', signal: controller.signal,
      fetchImpl: async () => { calls++; controller.abort(reason); throw reason },
    })
  }, { attempts: 3, baseDelayMs: 0, label: 'cancelled-source', signal: controller.signal }), error => {
    assert.equal(error, reason)
    assert.equal(retry.getRetryPressure?.(error)?.nestedAttempts, 1)
    return true
  })
  assert.equal(calls, 1)
})

test('telemetry preserves an immutable pre-existing caller cancellation reason', async () => {
  const reason = Object.freeze(new Error('immutable caller cancellation'))
  await assert.rejects(retry.withRetry(() => assert.fail('cancelled source must not start'), {
    signal: AbortSignal.abort(reason), attempts: 2,
  }), error => error === reason)
  assert.deepEqual(retry.getRetryPressure(reason)?.httpStatusCounts, {})
})

test('telemetry retains request diagnostics without mutating an immutable in-flight cancellation reason', async () => {
  const controller = new AbortController()
  const reason = Object.freeze(new Error('immutable native cancellation'))
  await assert.rejects(retry.withRetry(() => fetchJsonWithRetry('https://employer.invalid/jobs', {
    attempts: 2, baseDelayMs: 0, signal: controller.signal,
    fetchImpl: async () => { controller.abort(reason); throw reason },
  }), { attempts: 2, signal: controller.signal }), error => error === reason)
  assert.equal(retry.getRetryPressure(reason)?.nestedAttempts, 1)
})

test('concurrently cancelled source operations retain separate diagnostics when they share one cancellation reason', async () => {
  const controller = new AbortController()
  const reason = Object.freeze(new Error('pipeline cancellation'))
  let readyCount = 0, ready
  const allReady = new Promise(resolve => { ready = resolve })
  const source = status => retry.withRetry(async () => {
    let requests = 0
    await fetchJsonWithRetry('https://employer.invalid/jobs', { attempts: 2, baseDelayMs: 0,
      fetchImpl: async () => response(++requests === 1 ? status : 200), signal: controller.signal })
    if (++readyCount === 2) ready()
    await new Promise((resolve, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }))
  }, { signal: controller.signal, attempts: 1 })
  const alpha = source(429), beta = source(503)
  const settled = Promise.allSettled([alpha, beta])
  await allReady
  controller.abort(reason)
  for (const result of await settled) assert.equal(result.reason, reason)
  assert.deepEqual(retry.getRetryPressure(alpha)?.httpStatusCounts, { 429: 1 })
  assert.deepEqual(retry.getRetryPressure(beta)?.httpStatusCounts, { 503: 1 })
})
