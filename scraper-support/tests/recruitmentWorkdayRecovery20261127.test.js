import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { createHash } from 'node:crypto'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { workdayRequestScheduler } from '../myworkday/requestScheduler.js'
import { fetchWorkdayJobsApiPage } from '../myworkday/engine.js'

const config = {
  source: 'workday-recovery-fixture', companyName: 'Example Company',
  companyCareerPage: 'https://employer.test/careers/',
}
const boardUrl = 'https://fixture.wd989.myworkdayjobs.com/External'
const apiUrl = 'https://fixture.wd989.myworkdayjobs.com/wday/cxs/fixture/External/jobs'
const emptyInventory = '{"total":0,"jobPostings":[]}'
const responseAt = (url, body, status = 200, headers = {}) => {
  const response = new Response(body, { status, headers: { 'content-type': 'application/json', ...headers } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}
const interruptedResponse = (url, status, headers = {}) => {
  let emitted = false
  return responseAt(url, new ReadableStream({
    pull(controller) {
      if (!emitted) { emitted = true; controller.enqueue(Buffer.from('partial-body')); return }
      controller.error(new TypeError('terminated'))
    },
  }), status, headers)
}

function harness(t, reply, overrides = {}, now = Date.now()) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now })
  t.after(() => {
    for (const state of workdayRequestScheduler.shards.values()) clearTimeout(state.timer)
    workdayRequestScheduler.shards.clear()
  })
  const requests = []
  const pending = createVerifiedRecruitmentScraper(config).run({
    sourceTimeoutMs: 3000,
    fetchPage: async url => ({ status: 200, url, html: '<h1>Example Company Careers</h1><a href="' + boardUrl + '">Jobs</a>' }),
    fetchImpl: async (url, options) => {
      requests.push({ url, at: Date.now(), options })
      assert.equal(url, apiUrl)
      assert.equal(options.method, 'POST')
      return reply(url, requests.length, options)
    },
    ...overrides,
  }).then(jobs => ({ jobs, observed: jobs[RECRUITMENT_OBSERVATIONS] }), error => ({ error, observed: error?.recruitmentObservations }))
  return { requests, pending, async settle() {
    for (let tick = 0; tick < 12; tick += 1) {
      await setImmediate()
      t.mock.timers.tick(1000)
    }
    return pending
  } }
}

for (const status of [429, 503]) {
  test('recruitment raw Workday recovers ordinary HTTP ' + status + ' while retaining each response receipt', async t => {
    const reader = harness(t, (url, attempt) => attempt === 1
      ? responseAt(url, 'Try later', status, { 'retry-after': '2' })
      : responseAt(url, emptyInventory))
    const result = await reader.settle()
    assert.equal(result.error, undefined)
    assert.equal(result.observed.nativeInventoryReads[0].reportedTotal, 0)
    assert.equal(result.observed.requestCount, 3)
    assert.deepEqual(result.observed.receipts.map(row => row.status), [200, status, 200])
    assert.ok(reader.requests[1].at - reader.requests[0].at >= 2000)
    assert.equal(result.observed.receipts[1].retryAfter, '2')
    assert.equal(result.observed.receipts[1].bodySHA256, createHash('sha256').update('Try later').digest('hex'))
    assert.equal(readInventoryEvidence(result.jobs).status, 'coverage-gap')
    assert.equal(result.observed.lifecycleCleanupAllowed, false)
    assert.equal(result.observed.sourceScopeComplete, false)
  })
}

for (const status of [429, 503]) {
  test('recruitment raw Workday recovers an interrupted HTTP ' + status + ' body without erasing its status', async t => {
    const reader = harness(t, (url, attempt) => attempt === 1
      ? interruptedResponse(url, status, { 'retry-after': '0' })
      : responseAt(url, emptyInventory))
    const result = await reader.settle()
    assert.equal(result.error, undefined)
    assert.equal(reader.requests.length, 2)
    const receipt = result.observed.receipts[1]
    assert.equal(receipt.status, status)
    assert.equal(receipt.bodyComplete, false)
    assert.equal(receipt.bodyBytes, 12)
    assert.equal(receipt.bodySHA256, createHash('sha256').update('partial-body').digest('hex'))
  })
}

for (const [status, headers] of [[200, { 'cf-mitigated': 'challenge' }], [429, { 'x-amzn-waf-action': 'challenge' }]]) {
  test('recruitment raw Workday stops declared HTTP ' + status + ' challenges before parsing a plausible inventory', async t => {
    const reader = harness(t, url => responseAt(url, emptyInventory, status, headers))
    const result = await reader.settle()
    assert.ok(result.error)
    assert.equal(reader.requests.length, 1)
    assert.equal(result.observed.requestCount, 2)
    assert.equal(result.observed.nativeInventoryReads.length, 0)
    assert.equal(result.observed.failures[0].accessChallenge, true)
    assert.equal(result.observed.receipts[1].status, status)
    assert.equal(result.observed.receipts[1].accessChallenge, true)
    assert.equal(result.observed.receipts[1].bodyComplete, false)
    assert.equal(result.observed.lifecycleCleanupAllowed, false)
  })
}

test('recruitment raw Workday preserves an observed 403 through an interrupted body and stops', async t => {
  const reader = harness(t, url => interruptedResponse(url, 403))
  const result = await reader.settle()
  assert.ok(result.error)
  assert.equal(reader.requests.length, 1)
  assert.equal(result.observed.failures[0].status, 403)
  assert.equal(result.observed.receipts[1].status, 403)
  assert.equal(result.observed.receipts[1].bodyComplete, false)
})

test('recruitment raw Workday stops at three physical throttle attempts', async t => {
  const reader = harness(t, url => responseAt(url, 'Try later', 429, { 'retry-after': '0' }))
  const result = await reader.settle()
  assert.ok(result.error)
  assert.equal(reader.requests.length, 3)
  assert.equal(result.observed.requestCount, 4)
  assert.deepEqual(result.observed.receipts.map(row => row.status), [200, 429, 429, 429])
})

for (const maxRequests of [2, 3]) {
  test('recruitment raw Workday retries cannot exceed the physical request budget of ' + maxRequests, async t => {
    const reader = harness(t, url => responseAt(url, 'Try later', 429, { 'retry-after': '0' }), { maxRequests })
    const result = await reader.settle()
    assert.ok(result.error)
    assert.equal(reader.requests.length, maxRequests - 1)
    assert.equal(result.observed.requestCount, maxRequests)
    assert.equal(result.observed.receipts.length, maxRequests)
    assert.equal(result.observed.failures[0].status, 429)
  })
}

test('recruitment raw Workday charges a successful retry to the remaining physical request budget', async t => {
  const reader = harness(t, (url, attempt) => responseAt(url, attempt === 1 ? 'Try later' : emptyInventory,
    attempt === 1 ? 429 : 200, { 'retry-after': '0' }), { maxRequests: 3 })
  const result = await reader.settle()
  assert.equal(result.error, undefined)
  assert.equal(reader.requests.length, 2)
  assert.equal(result.observed.requestCount, 3)
})

test('recruitment raw Workday cancels a throttle wait with the exact opaque caller reason', async t => {
  const controller = new AbortController()
  const reason = Object.freeze({ get status() { throw new Error('Cancellation must remain opaque') } })
  const reader = harness(t, url => responseAt(url, 'Try later', 429, { 'retry-after': '3600' }), { signal: controller.signal })
  await setImmediate()
  controller.abort(reason)
  assert.equal((await reader.pending).error, reason)
  assert.equal(reader.requests.length, 1)
})

test('recruitment raw Workday keeps the source deadline while waiting for Retry-After', async t => {
  const keepAlive = setInterval(() => {}, 10)
  try {
    const reader = harness(t, url => responseAt(url, 'Try later', 429, { 'retry-after': '3600' }), { sourceTimeoutMs: 25 })
    const result = await reader.pending
    assert.equal(result.error?.name, 'TimeoutError')
    assert.equal(reader.requests.length, 1)
  } finally { clearInterval(keepAlive) }
})

test('recruitment raw Workday retains exact API response authority before retrying', async t => {
  const reader = harness(t, () => responseAt('https://foreign.wd989.myworkdayjobs.com/wday/cxs/other/External/jobs', 'Try later', 429, { 'retry-after': '0' }))
  const result = await reader.settle()
  assert.ok(result.error)
  assert.equal(reader.requests.length, 1)
  assert.match(result.observed.failures[0].message, /redirect changed authority/)
})

test('recruitment raw Workday cannot retry through a per-response byte limit', async t => {
  const reader = harness(t, url => responseAt(url, 'x'.repeat(4000001), 429, { 'retry-after': '0' }))
  const result = await reader.settle()
  assert.ok(result.error)
  assert.equal(reader.requests.length, 1)
  assert.match(result.observed.failures[0].message, /response body exceeds its limit/)
})

test('recruitment raw Workday counts failed and successful retry bodies against its aggregate byte budget', async t => {
  const reader = harness(t, (url, attempt, options) => {
    if (attempt < 3) return responseAt(url, 'x'.repeat(3999999), 429, { 'retry-after': '0' })
    const { offset } = JSON.parse(options.body)
    const body = JSON.stringify({ total: 81, jobPostings: Array.from({ length: offset < 80 ? 20 : 1 }, (_, index) => ({
      title: 'Software Engineer', externalPath: '/job/US/Engineer_R' + (offset + index + 1),
      locationsText: 'United States', bulletFields: ['R' + (offset + index + 1)],
    })) })
    return responseAt(url, body.padEnd(3999999, ' '))
  }, { maxRequests: 20 })
  const result = await reader.settle()
  assert.equal(reader.requests.length, 6)
  assert.equal(result.observed.requestCount, 7)
  assert.match(result.observed.failures[0].message, /aggregate byte budget reached/)
  assert.equal(result.observed.receipts.at(-1).bodyComplete, false)
  assert.equal(result.observed.lifecycleCleanupAllowed, false)
})

test('non-Workday raw transports keep their existing single-read behavior', async () => {
  let requests = 0
  await assert.rejects(createVerifiedRecruitmentScraper(config).run({ fetchImpl: async url => {
    requests += 1
    return responseAt(url, 'Try later', 429, { 'retry-after': '0' })
  } }), error => error.recruitmentObservations.requestCount === 1 && error.recruitmentObservations.failures[0].status === 429)
  assert.equal(requests, 1)
})

for (const status of [200, 429, 503]) {
  test('recruitment raw Workday stops explicit challenge HTML served with HTTP ' + status, async t => {
    const reader = harness(t, url => responseAt(url, '<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/check.js"></script>',
      status, { 'content-type': 'text/html', 'retry-after': '0' }))
    const result = await reader.settle()
    assert.ok(result.error)
    assert.equal(reader.requests.length, 1)
    assert.equal(result.observed.failures[0].accessChallenge, true)
    assert.equal(result.observed.receipts[1].accessChallenge, true)
    assert.equal(result.observed.receipts[1].bodyComplete, true)
  })
}

test('recruitment raw Workday stops readable maintenance instead of treating it as an ordinary 503', async t => {
  const reader = harness(t, url => responseAt(url, 'Workday is currently unavailable', 503, { 'retry-after': '0' }))
  const result = await reader.settle()
  assert.ok(result.error)
  assert.equal(reader.requests.length, 1)
  assert.equal(result.observed.failures[0].code, 'WORKDAY_UPSTREAM_UNAVAILABLE')
})

test('recruitment raw Workday honors an HTTP-date Retry-After', async t => {
  const reader = harness(t, (url, attempt) => attempt === 1
    ? responseAt(url, 'Try later', 503, { 'retry-after': 'Fri, 27 Nov 2026 00:00:03 GMT' })
    : responseAt(url, emptyInventory), {}, Date.UTC(2026, 10, 27))
  assert.equal((await reader.settle()).error, undefined)
  assert.equal(reader.requests.length, 2)
  assert.ok(reader.requests[1].at >= 1795737603000)
})

test('recruitment raw Workday shares its server cooldown with native engine API peers', async t => {
  const starts = []
  t.mock.method(globalThis, 'fetch', async () => {
    starts.push(Date.now())
    return Response.json({ total: 0, jobPostings: [] })
  })
  const reader = harness(t, (url, attempt) => attempt === 1
    ? responseAt(url, 'Try later', 429, { 'retry-after': '2' })
    : responseAt(url, emptyInventory))
  await setImmediate()
  const peer = fetchWorkdayJobsApiPage({
    jobsApiUrl: 'https://peer.wd989.myworkdayjobs.com/wday/cxs/peer/External/jobs', appliedFacets: {}, offset: 0,
  })
  await setImmediate()
  assert.equal(starts.length, 0)
  await reader.settle()
  await peer
  assert.equal(starts.length, 1)
  assert.ok(starts[0] - reader.requests[0].at >= 2000)
})

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function ownershipHarness(t, reply) {
  const previous = { maxConcurrent: workdayRequestScheduler.maxConcurrent, minIntervalMs: workdayRequestScheduler.minIntervalMs }
  workdayRequestScheduler.maxConcurrent = 1
  workdayRequestScheduler.minIntervalMs = 0
  const caller = new AbortController()
  const reason = Object.freeze({ get status() { throw new Error('Caller cancellation must remain opaque') } })
  const reader = harness(t, reply, { signal: caller.signal, sourceTimeoutMs: 5000 })
  const peerCaller = new AbortController()
  let outcome, peerRelease, peerAdmitted = false
  void reader.pending.then(value => { outcome = value })
  t.after(() => {
    peerCaller.abort(new Error('Ownership test cleanup'))
    peerRelease?.()
    Object.assign(workdayRequestScheduler, previous)
  })
  return {
    ...reader, caller, reason,
    state: () => workdayRequestScheduler.stateFor(apiUrl),
    outcome: () => outcome,
    peerAdmitted: () => peerAdmitted,
    queuePeer: () => workdayRequestScheduler.acquire('https://peer.wd989.myworkdayjobs.com/External', { signal: peerCaller.signal })
      .then(release => { peerRelease = release; peerAdmitted = true }, () => {}),
  }
}

test('cancelled Workday fetch retains its permit through late response disposal while rejecting the caller promptly', async t => {
  const fetch = deferred(), cleanup = deferred()
  let cleanupStarted = 0
  const response = responseAt(apiUrl, emptyInventory)
  t.mock.method(response.body, 'cancel', () => { cleanupStarted++; return cleanup.promise })
  const reader = ownershipHarness(t, () => fetch.promise)
  t.after(async () => { fetch.resolve(response); cleanup.resolve(); await setImmediate() })
  await setImmediate()
  assert.equal(reader.state().active, 1)
  reader.caller.abort(reader.reason)
  await setImmediate()
  assert.equal(reader.outcome()?.error, reader.reason, 'caller rejection must not wait for a transport that ignores abort')
  const peer = reader.queuePeer()
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false, 'the pending original fetch still owns its shard permit')
  assert.equal(reader.state().active, 1)
  fetch.resolve(response)
  await setImmediate()
  assert.equal(cleanupStarted, 1)
  assert.equal(reader.peerAdmitted(), false, 'late response cleanup must remain inside the same ownership')
  cleanup.resolve()
  await peer
  assert.equal(reader.peerAdmitted(), true)
  assert.equal(reader.requests.length, 1)
})

test('a never-settling cancelled Workday fetch releases its permit only after the bounded ownership grace', async t => {
  const fetch = deferred()
  const reader = ownershipHarness(t, () => fetch.promise)
  t.after(async () => { fetch.resolve(responseAt(apiUrl, emptyInventory)); await setImmediate() })
  await setImmediate()
  reader.caller.abort(reader.reason)
  await setImmediate()
  assert.equal(reader.outcome()?.error, reader.reason)
  const peer = reader.queuePeer()
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false)
  t.mock.timers.tick(999)
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false, 'unsettled transport ownership cannot be released before the grace')
  t.mock.timers.tick(1)
  await peer
  assert.equal(reader.peerAdmitted(), true, 'a transport that ignores abort cannot retain shard capacity forever')
})

test('a cancelled Workday fetch observes a late rejection before admitting its waiting peer', async t => {
  const fetch = deferred()
  const reader = ownershipHarness(t, () => fetch.promise)
  t.after(async () => { fetch.reject(new Error('Late transport failure')); await setImmediate() })
  await setImmediate()
  reader.caller.abort(reader.reason)
  await setImmediate()
  assert.equal(reader.outcome()?.error, reader.reason)
  const peer = reader.queuePeer()
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false)
  fetch.reject(new Error('Late transport failure'))
  await peer
  assert.equal(reader.peerAdmitted(), true)
  assert.equal(reader.outcome()?.error, reader.reason)
})

test('a cancelled Workday reader rejects promptly and owns both its pending read and delayed disposal', async t => {
  const read = deferred(), cleanup = deferred()
  let reads = 0, cleanups = 0
  const response = responseAt(apiUrl, emptyInventory)
  t.mock.method(response.body, 'getReader', () => ({
    read: () => { reads++; return read.promise },
    cancel: () => { cleanups++; return cleanup.promise },
    releaseLock() {},
  }))
  const reader = ownershipHarness(t, () => response)
  t.after(async () => { read.resolve({ done: true }); cleanup.resolve(); await setImmediate() })
  await setImmediate()
  assert.equal(reads, 1)
  reader.caller.abort(reader.reason)
  await setImmediate()
  assert.equal(reader.outcome()?.error, reader.reason, 'reader cleanup must not delay the exact caller cancellation')
  assert.equal(cleanups, 1)
  const peer = reader.queuePeer()
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false)
  cleanup.resolve()
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false, 'resolved cancel is insufficient when the acquired reader still ignores it')
  read.resolve({ done: true })
  await peer
  assert.equal(reader.peerAdmitted(), true)
})

test('ignored Workday reader cancellation and disposal cannot hold a permit beyond the ownership grace', async t => {
  const read = deferred(), cleanup = deferred()
  const response = responseAt(apiUrl, emptyInventory)
  t.mock.method(response.body, 'getReader', () => ({ read: () => read.promise, cancel: () => cleanup.promise, releaseLock() {} }))
  const reader = ownershipHarness(t, () => response)
  t.after(async () => { read.resolve({ done: true }); cleanup.resolve(); await setImmediate() })
  await setImmediate()
  reader.caller.abort(reader.reason)
  await setImmediate()
  assert.equal(reader.outcome()?.error, reader.reason)
  const peer = reader.queuePeer()
  t.mock.timers.tick(999)
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false)
  t.mock.timers.tick(1)
  await peer
  assert.equal(reader.peerAdmitted(), true)
})

test('a late Workday response with ignored disposal has a bounded permit transfer and one cleanup attempt', async t => {
  const fetch = deferred(), cleanup = deferred()
  let cleanupStarted = 0
  const response = responseAt(apiUrl, emptyInventory)
  t.mock.method(response.body, 'cancel', () => { cleanupStarted++; return cleanup.promise })
  const reader = ownershipHarness(t, () => fetch.promise)
  t.after(async () => { fetch.resolve(response); cleanup.resolve(); await setImmediate() })
  await setImmediate()
  reader.caller.abort(reader.reason)
  await setImmediate()
  assert.equal(reader.outcome()?.error, reader.reason)
  const peer = reader.queuePeer()
  t.mock.timers.tick(500)
  fetch.resolve(response)
  await setImmediate()
  assert.equal(cleanupStarted, 1)
  assert.equal(reader.peerAdmitted(), false)
  t.mock.timers.tick(499)
  await setImmediate()
  assert.equal(reader.peerAdmitted(), false)
  t.mock.timers.tick(1)
  await peer
  assert.equal(reader.peerAdmitted(), true)
  assert.equal(cleanupStarted, 1)
  t.mock.timers.tick(500)
  await setImmediate()
})
