import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper } from '../providers/index.js'
import { withRetry, getRetryMetadata, getRetryPressure } from '../utils/retry.js'
import { pacingProvider, pacingPayload } from './apiPortalPacing20261031.fixture.js'

test('a recovered registered portal retry records actual attempts, failure, server delay and HTTP status once', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async url => ++calls === 1
    ? new Response(null, { status: 429, headers: { 'Retry-After': '0.04' } })
    : Response.json(pacingPayload(url)))
  const jobs = await withRetry(() => createCatalogScraper(pacingProvider({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 }, { detail: false })).run(), { attempts: 3, baseDelayMs: 0, label: 'portal-telemetry-regression' })
  assert.equal(jobs.length, 3)
  assert.equal(calls, 2)
  assert.deepEqual(getRetryMetadata(jobs), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
  assert.deepEqual(getRetryPressure(jobs), { nestedScopes: 1, nestedAttempts: 2, nestedRetries: 1, nestedFailedAttempts: 1, nestedRetryDelayMs: 40, httpStatusCounts: { 429: 1 } })
})

test('ordinary portal pacing is excluded from retry-delay telemetry', async t => {
  t.mock.method(globalThis, 'fetch', async url => Response.json(pacingPayload(url)))
  const jobs = await withRetry(() => createCatalogScraper(pacingProvider({ minimumIntervalMs: 10 })).run(), { attempts: 1, baseDelayMs: 0, label: 'portal-pacing-telemetry' })
  assert.equal(jobs.length, 3)
  assert.deepEqual(getRetryPressure(jobs), { nestedScopes: 4, nestedAttempts: 4, nestedRetries: 0, nestedFailedAttempts: 0, nestedRetryDelayMs: 0, httpStatusCounts: {} })
})

test('an unpaced failed registered request records HTTP status without adding retries', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 503, headers: { 'Retry-After': '1' } }) })
  await assert.rejects(withRetry(() => createCatalogScraper(pacingProvider(undefined, { detail: false })).run(), { attempts: 1, baseDelayMs: 0, label: 'portal-unpaced-telemetry' }), error => {
    assert.deepEqual(getRetryPressure(error), { nestedScopes: 1, nestedAttempts: 1, nestedRetries: 0, nestedFailedAttempts: 1, nestedRetryDelayMs: 0, httpStatusCounts: { 503: 1 } })
    return true
  })
  assert.equal(calls, 1)
})
