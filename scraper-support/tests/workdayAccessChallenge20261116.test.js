import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchWorkdayJobsApiPage } from '../myworkday/engine.js'
import { classifyScraperError } from '../utils/failureClassification.js'

const BOARD = 'https://challenge-fixture.wd503.myworkdayjobs.com/External'
const API = 'https://challenge-fixture.wd503.myworkdayjobs.com/wday/cxs/challenge-fixture/External/jobs'
const scheduler = { acquire: async () => () => {}, recordRateLimit() {} }
const page = extra => fetchWorkdayJobsApiPage({ jobsApiUrl: API, appliedFacets: {}, offset: 0,
  requestScheduler: scheduler, retryBaseDelayMs: 0, ...extra })
const response = (url, status, headers = {}, body = '<html><body>Verify you are human</body></html>') =>
  Object.defineProperty(new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } }), 'url', { value: url })

for (const [name, bootstrapUrl, target, status] of [
  ['bootstrap', BOARD, BOARD, 429],
  ['jobs API', null, API, 429],
  ['successful-status jobs API', null, API, 200],
]) test('Workday stops a positively identified access challenge on the ' + name, async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async url => {
    requests++
    assert.equal(url, target)
    return response(url, status, { 'cf-mitigated': 'challenge', 'retry-after': '0' })
  })
  await assert.rejects(page({ bootstrapUrl }), error => {
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied',
    })
    assert.equal(error.abortRetries, true)
    assert.equal(error.httpStatus, status)
    assert.equal(error.requestedUrl, target)
    assert.equal(error.responseUrl, target)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.accessChallenge, true)
    return true
  })
  assert.equal(requests, 1, 'an access challenge must not trigger more requests or an API fallback')
})

test('Workday exhausted ordinary 429 retries retain their HTTP diagnostics and blocked classification', async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async url => {
    requests++
    return response(url, 429, { 'retry-after': '0' })
  })
  await assert.rejects(page(), error => {
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied',
    })
    assert.equal(error.jobsApiHttpStatus, 429)
    assert.equal(error.httpStatus, 429)
    assert.equal(error.retryDelayMs, 0)
    return true
  })
  assert.equal(requests, 3, 'a transient rate limit retains its bounded recovery attempts')
})

test('Workday uses the observed HTTP status when an error envelope contradicts the response', async t => {
  t.mock.method(globalThis, 'fetch', async url => response(url, 429,
    { 'content-type': 'application/json', 'retry-after': '0' }, JSON.stringify({ errorCode: 'HTTP_503', httpStatus: 503 })))
  await assert.rejects(page(), error => {
    assert.equal(error.jobsApiHttpStatus, 429)
    assert.equal(error.httpStatus, 429)
    assert.equal(classifyScraperError(error).failureKind, 'blocked_or_access_denied')
    assert.match(error.message, /HTTP_429/)
    return true
  })
})
