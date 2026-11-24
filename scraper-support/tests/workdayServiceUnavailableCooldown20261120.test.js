import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'

import { fetchWorkdayJobsApiPage, WorkdayHostCircuitBreaker } from '../myworkday/engine.js'
import { WorkdayRequestScheduler } from '../myworkday/requestScheduler.js'

const page = (tenant, options = {}) => fetchWorkdayJobsApiPage({
  jobsApiUrl: `https://${tenant}.wd931.myworkdayjobs.com/wday/cxs/${tenant}/External/jobs`,
  appliedFacets: {}, offset: 0, retryBaseDelayMs: 0, ...options,
})

test('Workday honors a service-unavailable Retry-After before admitting a peer on the same shard', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const requestScheduler = new WorkdayRequestScheduler({ minIntervalMs: 0 })
  const circuitBreaker = new WorkdayHostCircuitBreaker({ failureThreshold: 1 })
  let peerStartedAt = null
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('unavailable.')) {
      return Response.json({ errorCode: 'HTTP_503', httpStatus: 503 }, {
        status: 503, headers: { 'retry-after': '120' },
      })
    }
    peerStartedAt = Date.now()
    return Response.json({ total: 0, jobPostings: [] })
  })

  await assert.rejects(page('unavailable', { requestScheduler, circuitBreaker }), error => {
    assert.equal(error.httpStatus, 503)
    return true
  })
  const peer = page('peer', { requestScheduler, circuitBreaker })
  await setImmediate()
  assert.equal(peerStartedAt, null, 'the peer must wait for the server cooldown')
  t.mock.timers.tick(119_999)
  await setImmediate()
  assert.equal(peerStartedAt, null)
  t.mock.timers.tick(1)
  await peer
  assert.equal(peerStartedAt, 120_000)
})

test('Workday carries the service-unavailable Retry-After on the terminal native error', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ errorCode: 'HTTP_503', httpStatus: 503 }, {
    status: 503, headers: { 'retry-after': '120' },
  }))
  await assert.rejects(page('hint', {
    requestScheduler: new WorkdayRequestScheduler({ minIntervalMs: 0 }),
    circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 1 }),
  }), error => {
    assert.equal(error.httpStatus, 503)
    assert.equal(error.retryDelayMs, 120_000)
    return true
  })
})

for (const retryAfter of [null, 'invalid']) {
  test(`Workday leaves ordinary 503 pacing unchanged for a ${retryAfter === null ? 'missing' : 'malformed'} Retry-After`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
    const requestScheduler = new WorkdayRequestScheduler({ minIntervalMs: 0 })
    const circuitBreaker = new WorkdayHostCircuitBreaker({ failureThreshold: 1 })
    let peerStartedAt = null
    t.mock.method(globalThis, 'fetch', async url => {
      if (String(url).includes('unavailable.')) {
        return new Response('Service unavailable', {
          status: 503, headers: retryAfter === null ? {} : { 'retry-after': retryAfter },
        })
      }
      peerStartedAt = Date.now()
      return Response.json({ total: 0, jobPostings: [] })
    })
    await assert.rejects(page('unavailable', { requestScheduler, circuitBreaker }), error => {
      assert.equal(error.httpStatus, 503)
      assert.equal(error.retryDelayMs, undefined)
      return true
    })
    const peer = page('peer', { requestScheduler, circuitBreaker })
    await setImmediate()
    assert.equal(peerStartedAt, 0)
    await peer
  })
}

test('Workday cancels a peer queued behind a service-unavailable Retry-After with the exact caller reason', async t => {
  const requestScheduler = new WorkdayRequestScheduler({ minIntervalMs: 0 })
  const circuitBreaker = new WorkdayHostCircuitBreaker({ failureThreshold: 1 })
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1
    return new Response('Service unavailable', { status: 503, headers: { 'retry-after': '120' } })
  })
  await assert.rejects(page('unavailable', { requestScheduler, circuitBreaker }))
  const controller = new AbortController()
  const reason = Object.freeze({ caller: 'service-unavailable-peer' })
  const peer = page('peer', { requestScheduler, circuitBreaker, signal: controller.signal })
  controller.abort(reason)
  await assert.rejects(peer, error => error === reason)
  assert.equal(requests, 1)
})

test('Workday never retries a service-unavailable access challenge with Retry-After', async t => {
  let requests = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1
    return new Response('Managed challenge', {
      status: 503, headers: { 'cf-mitigated': 'challenge', 'retry-after': '120' },
    })
  })
  await assert.rejects(page('challenge', {
    requestScheduler: new WorkdayRequestScheduler({ minIntervalMs: 0 }),
    circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 99 }),
  }), error => {
    assert.equal(error.accessChallenge, true)
    assert.equal(error.abortRetries, true)
    assert.equal(error.httpStatus, 503)
    assert.equal(error.retryDelayMs, 120_000)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    return true
  })
  assert.equal(requests, 1)
})
