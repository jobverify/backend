import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { setImmediate } from 'node:timers/promises'
import { WorkdayRequestScheduler } from '../myworkday/requestScheduler.js'

import { fetchWorkdayJobsApiPage, runWorkdayScraper } from '../myworkday/engine.js'

const page = (tenant, shard = 'wd901', extra = {}) => fetchWorkdayJobsApiPage({
  jobsApiUrl: `https://${tenant}.${shard}.myworkdayjobs.com/wday/cxs/${tenant}/External/jobs`,
  appliedFacets: {}, offset: 0, retryBaseDelayMs: 0, ...extra,
})
const empty = () => Response.json({ total: 0, jobPostings: [] })

test('Workday spaces requests across tenants on the same shard while other shards remain independent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const starts = new Map()
  t.mock.method(globalThis, 'fetch', async (url) => {
    starts.set(new URL(url).hostname.split('.')[0], Date.now())
    return empty()
  })

  const pending = Promise.all([page('first'), page('second'), page('independent', 'wd902')])
  await setImmediate()
  assert.equal(starts.get('first'), 0)
  assert.equal(starts.get('independent'), 0, 'another shard must not share the queue')
  assert.equal(starts.has('second'), false, 'the second tenant must wait for its shard interval')
  t.mock.timers.tick(250)
  await pending
  assert.equal(starts.get('second'), 250, 'same-shard requests must retain the configured pacing')
})

test('Workday shares a server cooldown with the next tenant on that shard', async (t) => {
  let rateLimitedAt
  let peerStartedAt
  let firstAttempts = 0
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('limited.')) {
      firstAttempts += 1
      if (firstAttempts === 1) {
        rateLimitedAt = Date.now()
        return Response.json({ errorCode: 'HTTP_429', httpStatus: 429 }, { status: 429, headers: { 'retry-after': '0.4' } })
      }
    } else peerStartedAt = Date.now()
    return empty()
  })

  const limited = page('limited', 'wd903')
  await new Promise((resolve) => setTimeout(resolve, 20))
  await Promise.all([limited, page('peer', 'wd903')])
  assert.ok(peerStartedAt - rateLimitedAt >= 390, 'peers must respect Retry-After from another tenant')
})

test('Workday cancels a rate-limit wait promptly instead of leaving background retries alive', async (t) => {
  const controller = new AbortController()
  const reason = new Error('source cancelled')
  t.mock.method(globalThis, 'fetch', async () => {
    setTimeout(() => controller.abort(reason), 5)
    return Response.json({ errorCode: 'HTTP_429', httpStatus: 429 }, { status: 429, headers: { 'retry-after': '0.2' } })
  })
  const startedAt = Date.now()
  await assert.rejects(page('cancelled', 'wd904', { signal: controller.signal }), (error) => error === reason)
  assert.ok(Date.now() - startedAt < 150, 'cancellation must interrupt backoff')
})

test('Workday queues details behind listings without exceeding shard capacity', async () => {
  const scheduler = new WorkdayRequestScheduler({ minIntervalMs: 0, maxConcurrent: 1 })
  const url = 'https://one.wd905.myworkdayjobs.com/External'
  const releaseActive = await scheduler.acquire(url, { kind: 'detail' })
  let detailStarted = false
  const queuedDetail = scheduler.acquire(url, { kind: 'detail' }).then((release) => {
    detailStarted = true
    return release
  })
  const queuedListing = scheduler.acquire('https://two.wd905.myworkdayjobs.com/External')
  await Promise.resolve()
  assert.equal(detailStarted, false)
  releaseActive()
  const releaseListing = await queuedListing
  assert.equal(detailStarted, false, 'the listing must get the available slot first')
  releaseListing()
  const releaseDetail = await queuedDetail
  releaseDetail()
})

test('Workday removes a cancelled request from a shard cooldown queue', async () => {
  const scheduler = new WorkdayRequestScheduler({ minIntervalMs: 0 })
  const url = 'https://one.wd906.myworkdayjobs.com/External'
  const controller = new AbortController()
  const reason = new Error('cancel queued request')
  scheduler.recordRateLimit(url, 60_000)
  const pending = scheduler.acquire(url, { signal: controller.signal })
  controller.abort(reason)
  await assert.rejects(pending, (error) => error === reason)
  // The cancelled queue must also clear its timer so the test process can exit.
})

test('Workday detail Retry-After pauses peer listings using the actual server delay', async (t) => {
  const scheduler = new WorkdayRequestScheduler({ minIntervalMs: 0 })
  let limitedAt
  let peerStartedAt
  const detailUrls = []
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (String(url).includes('peer.')) {
      peerStartedAt = Date.now()
      return empty()
    }
    if (init.method === 'POST') return Response.json({
      total: 1,
      jobPostings: [{ title: 'Engineer', externalPath: '/job/Bangalore/Engineer_R1', locationsText: 'Bangalore, India' }],
    })
    if (String(url).includes('/job/')) {
      detailUrls.push(String(url))
      limitedAt = Date.now()
      return new Response('Too many requests', { status: 429, headers: { 'retry-after': '0.1' } })
    }
    return new Response('<html>Workday</html>')
  })
  const jobs = await runWorkdayScraper({
    company: 'Detail cooldown fixture',
    source: 'detail-cooldown',
    baseUrl: 'https://details.wd907.myworkdayjobs.com/External',
    scraperDir: fileURLToPath(new URL('../myworkday', import.meta.url)),
    requestScheduler: scheduler,
  })
  assert.equal(jobs.length, 1)
  assert.equal(detailUrls.length, 1, 'an API rate limit must not trigger an HTML fallback request')
  assert.match(detailUrls[0], /\/wday\/cxs\/details\/External\/job\//)
  await page('peer', 'wd907', { requestScheduler: scheduler })
  assert.ok(peerStartedAt - limitedAt >= 90)
  assert.ok(peerStartedAt - limitedAt < 1000, 'the actual header must replace the default five-second delay')
})
