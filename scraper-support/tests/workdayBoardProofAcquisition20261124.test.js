import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'

import { runWorkdayScraper, WorkdayHostCircuitBreaker } from '../myworkday/engine.js'
import { classifyScraperError } from '../utils/failureClassification.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const CORPORATE = 'https://proof-acquisition.example/careers'
const BOARD = 'https://proof-acquisition.wd998.myworkdayjobs.com/External'
const API = 'https://proof-acquisition.wd998.myworkdayjobs.com/wday/cxs/proof-acquisition/External/jobs'
const VANITY = 'https://jobs.proof-acquisition.example/External'
const htmlResponse = (url, body, status = 200, headers = {}) => Object.defineProperty(
  new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } }),
  'url', { value: url },
)

// Controlled acquisition responses exercise the real proof and inventory path.
// They are not captures or evidence of current employer vacancies.
const exercise = async (t, { corporate, vanity = null, requestTimeoutMs = 1000, signal = null,
  requestScheduler = { acquire: async () => () => {}, recordRateLimit() {} } } = {}) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-proof-acquisition-'))
  t.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-proof-acquisition-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    listingStrategy: 'jobs-api', inventoryScope: 'complete-board-country-proof',
    jobsApiUrl: API, detailUrlBase: BOARD, officialCareersUrl: CORPORATE,
    locationCountry: null, searchText: '',
    ...(vanity && { officialVanityCareersUrl: VANITY }),
  }))
  const calls = []
  let corporateAttempts = 0
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' })
    if (url === CORPORATE) return corporate(++corporateAttempts, init)
    if (url === VANITY && vanity) return vanity(init)
    if (url === BOARD) return htmlResponse(url, '<html><body>Controlled anonymous bootstrap</body></html>')
    if (url === API && init.method === 'POST') {
      assert.deepEqual(JSON.parse(init.body), { appliedFacets: {}, limit: 20, offset: 0, searchText: '' })
      return Object.defineProperty(Response.json({ total: 0, jobPostings: [] }), 'url', { value: url })
    }
    throw new Error('Unexpected HTTP boundary: ' + url)
  })
  let jobs, error
  try {
    jobs = await runWorkdayScraper({
      company: 'Controlled Workday proof acquisition', source: 'proof-acquisition',
      baseUrl: BOARD, scraperDir: directory, retryBaseDelayMs: 0, requestTimeoutMs,
      signal,
      nativeDetailRecovery: false,
      circuitBreaker: new WorkdayHostCircuitBreaker(),
      requestScheduler,
    })
  } catch (caught) { error = caught }
  return { jobs, error, calls }
}

for (const status of [429, 503]) test('Workday retries a transient corporate proof HTTP ' + status + ' before certifying inventory', async t => {
  const result = await exercise(t, {
    corporate: attempt => attempt === 1
      ? htmlResponse(CORPORATE, 'Temporary upstream response', status, { 'retry-after': '0' })
      : htmlResponse(CORPORATE, '<html><body><a href="' + BOARD + '">Open jobs</a></body></html>'),
  })
  assert.ifError(result.error)
  assert.equal(result.jobs.length, 0)
  assert.equal(readInventoryEvidence(result.jobs).status, 'complete-inventory')
  assert.deepEqual(result.calls.map(call => call.url), [CORPORATE, CORPORATE, BOARD, API, API])
})

test('Workday exhausts bounded corporate rate-limit recovery with the original status and retry hint', async t => {
  const result = await exercise(t, {
    corporate: () => htmlResponse(CORPORATE, 'Too many requests', 429, { 'retry-after': '0' }),
  })
  assert.equal(result.jobs, undefined)
  assert.equal(result.error.httpStatus, 429)
  assert.equal(result.error.retryDelayMs, 0)
  assert.equal(classifyScraperError(result.error).failureKind, 'blocked_or_access_denied')
  assert.deepEqual(result.calls.map(call => call.url), [CORPORATE, CORPORATE, CORPORATE])
})

test('Workday preserves a corporate proof denial without retrying or certifying inventory', async t => {
  const result = await exercise(t, {
    corporate: () => htmlResponse(CORPORATE, 'Forbidden', 403),
  })
  assert.equal(result.jobs, undefined)
  assert.equal(result.error.httpStatus, 403)
  assert.equal(classifyScraperError(result.error).failureKind, 'blocked_or_access_denied')
  assert.deepEqual(result.calls.map(call => call.url), [CORPORATE])
})

for (const target of ['corporate', 'vanity']) test('Workday preserves a managed ' + target + ' proof challenge and stops without another request', async t => {
  const challenge = url => htmlResponse(url, 'Managed challenge', 429,
    { 'cf-mitigated': 'challenge', 'retry-after': '0' })
  const result = await exercise(t, target === 'corporate'
    ? { corporate: () => challenge(CORPORATE) }
    : {
      corporate: () => htmlResponse(CORPORATE, '<html><body><a href="' + VANITY + '">Open jobs</a></body></html>'),
      vanity: () => challenge(VANITY),
    })
  assert.equal(result.jobs, undefined)
  assert.equal(result.error.accessChallenge, true)
  assert.equal(result.error.httpStatus, 429)
  assert.equal(result.error.requestedUrl, target === 'corporate' ? CORPORATE : VANITY)
  assert.equal(result.error.lifecycleCleanupAllowed, false)
  assert.equal(result.error.sourceScopeComplete, false)
  assert.deepEqual(classifyScraperError(result.error), {
    softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied',
  })
  assert.deepEqual(result.calls.map(call => call.url), target === 'corporate' ? [CORPORATE] : [CORPORATE, VANITY])
})

test('Workday preserves a corporate proof request deadline as a transport failure', async t => {
  const result = await exercise(t, {
    corporate: (_attempt, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    }),
    requestTimeoutMs: 20,
  })
  assert.equal(result.jobs, undefined)
  assert.equal(result.error.name, 'WorkdayRequestTimeoutError')
  assert.equal(classifyScraperError(result.error).failureKind, 'network_or_timeout')
  assert.deepEqual(result.calls.map(call => call.url), [CORPORATE])
})

test('Workday retains the corporate proof identity gate after a successful HTTP response', async t => {
  const result = await exercise(t, {
    corporate: () => htmlResponse(CORPORATE, '<html><body><a href="https://other.wd998.myworkdayjobs.com/External">Open jobs</a></body></html>'),
  })
  assert.equal(result.jobs, undefined)
  assert.equal(result.error.name, 'WorkdayIncompleteScopeError')
  assert.equal(classifyScraperError(result.error).failureKind, 'incomplete_location_scope')
  assert.deepEqual(result.calls.map(call => call.url), [CORPORATE])
})

const interruptedBody = (status, kind, signal) => htmlResponse(CORPORATE, new ReadableStream({
  start(controller) {
    if (kind === 'corrupt') controller.error(new TypeError('Controlled response transfer failure'))
    else signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
  },
}), status, { 'retry-after': '0' })

for (const status of [429, 503]) for (const kind of ['stalled', 'corrupt']) {
  test('Workday recovers corporate HTTP ' + status + ' without consuming its ' + kind + ' error body', async t => {
    const result = await exercise(t, {
      corporate: (attempt, init) => attempt === 1
        ? interruptedBody(status, kind, init.signal)
        : htmlResponse(CORPORATE, '<html><body><a href="' + BOARD + '">Open jobs</a></body></html>'),
      requestTimeoutMs: 20,
    })
    assert.ifError(result.error)
    assert.equal(readInventoryEvidence(result.jobs).status, 'complete-inventory')
    assert.deepEqual(result.calls.map(call => call.url), [CORPORATE, CORPORATE, BOARD, API, API])
  })
}

for (const kind of ['stalled', 'corrupt']) test('Workday preserves terminal corporate HTTP 403 with a ' + kind + ' error body', async t => {
  const result = await exercise(t, {
    corporate: (_attempt, init) => interruptedBody(403, kind, init.signal),
    requestTimeoutMs: 20,
  })
  assert.equal(result.jobs, undefined)
  assert.equal(result.error.httpStatus, 403)
  assert.equal(classifyScraperError(result.error).failureKind, 'blocked_or_access_denied')
  assert.deepEqual(result.calls.map(call => call.url), [CORPORATE])
})

const deferred = () => {
  let resolve
  const promise = new Promise(yes => { resolve = yes })
  return { promise, resolve }
}
const flush = async () => { for (let turn = 0; turn < 5; turn++) await setImmediate() }

test('Workday owns corporate error-body disposal before releasing its slot or starting recovery', async t => {
  const cleanup = deferred(), caller = new AbortController()
  let cancellations = 0, releases = 0, bodyReads = 0
  const pending = exercise(t, {
    signal: caller.signal,
    corporate: (attempt, init) => attempt > 1
      ? htmlResponse(CORPORATE, '<html><body><a href="' + BOARD + '">Open jobs</a></body></html>')
      : {
        ok: false, status: 429, url: CORPORATE,
        headers: new Headers({ 'content-type': 'text/html', 'retry-after': '0' }),
        body: { cancel() { cancellations++; return cleanup.promise } },
        text() {
          bodyReads++
          return new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
          })
        },
      },
    requestScheduler: { acquire: async () => () => { releases++ }, recordRateLimit() {} },
  })
  try {
    await flush()
    assert.equal(cancellations, 1)
    assert.equal(bodyReads, 0, 'an observed error status must not enter the HTML proof reader')
    assert.equal(releases, 0, 'body cancellation still owns the active request slot')
    cleanup.resolve()
    const result = await pending
    assert.ifError(result.error)
    assert.equal(readInventoryEvidence(result.jobs).status, 'complete-inventory')
    assert.equal(cancellations, 1)
    assert.equal(releases, 5)
  } finally {
    cleanup.resolve()
    caller.abort(new Error('Controlled test cleanup'))
    await pending
  }
})

for (const [label, reason] of [['opaque object', Object.freeze(Object.create(null))], ['null', null], ['zero', 0]]) {
  test('Workday preserves exact ' + label + ' caller cancellation during ordinary HTTP error disposal', async t => {
    const caller = new AbortController()
    let cancellations = 0, bodyReads = 0, releases = 0
    const result = await exercise(t, {
      signal: caller.signal,
      corporate: () => ({
        ok: false, status: 429, url: CORPORATE,
        headers: new Headers({ 'content-type': 'text/html', 'retry-after': '0' }),
        body: { cancel() { cancellations++; queueMicrotask(() => caller.abort(reason)); return Promise.resolve() } },
        text() { bodyReads++; queueMicrotask(() => caller.abort(reason)); return Promise.reject(new TypeError('Controlled transfer failure')) },
      }),
      requestScheduler: { acquire: async () => () => { releases++ }, recordRateLimit() {} },
    })
    assert.equal(result.jobs, undefined)
    assert.equal(result.error, reason)
    assert.equal(bodyReads, 0)
    assert.equal(cancellations, 1)
    assert.equal(releases, 1)
    assert.deepEqual(result.calls.map(call => call.url), [CORPORATE])
  })
}
