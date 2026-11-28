import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { fetchWorkdayJobsApiPage, runWorkdayScraper, WorkdayHostCircuitBreaker } from '../myworkday/engine.js'
import { classifyScraperError } from '../utils/failureClassification.js'

// Controlled HTTP responses exercise recovery, not current employer inventory.
const BOARD = 'https://http-recovery.wd997.myworkdayjobs.com/External'
const API = 'https://http-recovery.wd997.myworkdayjobs.com/wday/cxs/http-recovery/External/jobs'
const ROLE = '/job/Controlled-Office/Engineer_R1'
const DETAIL = API.replace(/\/jobs$/, '') + ROLE
const EMPTY = { total: 0, jobPostings: [] }
const scheduler = { acquire: async () => () => {}, recordRateLimit() {} }
const page = options => fetchWorkdayJobsApiPage({
  jobsApiUrl: API, appliedFacets: {}, offset: 0,
  requestScheduler: scheduler, circuitBreaker: new WorkdayHostCircuitBreaker(),
  retryBaseDelayMs: 0, requestTimeoutMs: 25, ...options,
})

const interruptedResponse = (url, status, kind, signal) => Object.defineProperty(new Response(new ReadableStream({
  start(controller) {
    if (kind === 'corrupt') controller.error(new TypeError('Controlled interrupted HTTP body'))
    else signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
  },
}), { status, headers: { 'content-type': 'text/html', 'retry-after': '0' } }), 'url', { value: url })

for (const boundary of ['bootstrap', 'jobs API']) {
  for (const status of [429, 503]) for (const kind of ['corrupt', 'stalled']) {
    test('Workday recovers ' + boundary + ' HTTP ' + status + ' with a ' + kind + ' error body', async t => {
      const requests = []
      t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
        requests.push(String(url))
        if (requests.length === 1) return interruptedResponse(url, status, kind, init.signal)
        if (String(url) === BOARD) return new Response('<html>Controlled bootstrap</html>')
        assert.equal(String(url), API)
        return Response.json(EMPTY)
      })
      assert.deepEqual(await page({ bootstrapUrl: boundary === 'bootstrap' ? BOARD : null }), EMPTY)
      assert.deepEqual(requests, boundary === 'bootstrap' ? [BOARD, BOARD, API] : [API, API])
    })
  }

  test('Workday retains terminal ' + boundary + ' HTTP 403 when its body fails', async t => {
    const requests = []
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      requests.push(String(url))
      return interruptedResponse(url, 403, 'corrupt', init.signal)
    })
    await assert.rejects(page({ bootstrapUrl: boundary === 'bootstrap' ? BOARD : null }), error => {
      assert.equal(error.httpStatus, 403)
      assert.equal(error.abortRetries, true)
      assert.equal(classifyScraperError(error).failureKind, 'blocked_or_access_denied')
      return true
    })
    assert.deepEqual(requests, [boundary === 'bootstrap' ? BOARD : API])
  })

  test('Workday exhausts ' + boundary + ' HTTP 429 recovery without treating its corrupt body as inventory', async t => {
    const requests = []
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      requests.push(String(url))
      return interruptedResponse(url, 429, 'corrupt', init.signal)
    })
    await assert.rejects(page({ bootstrapUrl: boundary === 'bootstrap' ? BOARD : null }), error => {
      assert.equal(error.httpStatus, 429)
      assert.equal(error.retryDelayMs, 0)
      assert.equal(classifyScraperError(error).failureKind, 'blocked_or_access_denied')
      return true
    })
    assert.deepEqual(requests, Array(3).fill(boundary === 'bootstrap' ? BOARD : API))
  })
}

const scopeRun = async (t, respond) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workday-http-recovery-'))
  t.after(() => {
    const resolved = fs.realpathSync(directory)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('workday-http-recovery-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify({
    listingStrategy: 'jobs-api', jobsApiUrl: API, detailUrlBase: BOARD,
    locationCountry: null, searchText: '', detailEnrichmentBudgetMs: 0,
  }))
  const requests = []
  let detailAttempts = 0
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    requests.push(String(url))
    if (String(url) === BOARD) return new Response('<html>Controlled bootstrap</html>')
    if (String(url) === API) return Response.json({ total: 1, jobPostings: [
      { title: 'Engineer', externalPath: ROLE, locationsText: '2 Locations', bulletFields: ['R1'] },
    ] })
    assert.equal(String(url), DETAIL, 'scope failure must not start an HTML fallback')
    return respond(++detailAttempts, init)
  })
  let jobs, error
  try {
    jobs = await runWorkdayScraper({
      source: 'http-recovery', company: 'Controlled Workday recovery', baseUrl: BOARD,
      scraperDir: directory, requestScheduler: scheduler,
      circuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 10 }),
      detailCircuitBreaker: new WorkdayHostCircuitBreaker({ failureThreshold: 10 }),
      retryBaseDelayMs: 0, requestTimeoutMs: 25, nativeDetailRecovery: false,
    })
  } catch (caught) { error = caught }
  return { jobs, error, requests }
}

for (const status of [429, 503]) for (const kind of ['corrupt', 'stalled']) {
  test('Workday recovers location-scope HTTP ' + status + ' with a ' + kind + ' error body before deciding India scope', async t => {
    const result = await scopeRun(t, (attempt, init) => attempt === 1
      ? interruptedResponse(DETAIL, status, kind, init.signal)
      : Response.json({ jobPostingInfo: {
        jobReqId: 'R1', title: 'Engineer', location: 'Bengaluru, India', additionalLocations: ['Pune, India'],
      } }))
    assert.ifError(result.error)
    assert.equal(result.jobs.length, 1)
    assert.ok(result.jobs[0].locations.some(location => /Pune/.test(location)))
    assert.deepEqual(result.requests, [BOARD, API, DETAIL, DETAIL])
  })
}

test('Workday scope denial with a corrupt body remains unavailable and cannot become successful empty', async t => {
  const result = await scopeRun(t, (_attempt, init) => interruptedResponse(DETAIL, 403, 'corrupt', init.signal))
  assert.equal(result.jobs, undefined)
  assert.equal(result.error.httpStatus, 403)
  assert.equal(classifyScraperError(result.error).failureKind, 'blocked_or_access_denied')
  assert.deepEqual(result.requests, [BOARD, API, DETAIL])
})
