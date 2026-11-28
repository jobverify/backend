import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { WorkdayRequestScheduler, workdayRequestScheduler } from '../myworkday/requestScheduler.js'
import { fetchWorkdayPage } from '../myworkday/pageFetch.js'
import { fetchWorkdayJobsApiPage } from '../myworkday/engine.js'
import { withRetry } from '../utils/retry.js'
import * as aptos from '../../scraper/aptosindia.workday/script.js'
import * as insightsoftware from '../../scraper/insightsoftware.workday/script.js'
import * as itron from '../../scraper/itronindia.workday/script.js'
import * as lattice from '../../scraper/latticesemiconductorindia/script.js'
import * as newfold from '../../scraper/newfolddigital.workday/script.js'
import * as renault from '../../scraper/renaultgroup/script.js'

const sources = [
  {
    module: aptos,
    careers: '<title>Careers at Aptos</title><h1><b>Aptos Careers</b></h1>Careers Quick Links brightest minds in retail technology <a href="https://aptos.wd108.myworkdayjobs.com/Aptos">View Jobs</a>',
    board: '<link rel="canonical" href="https://aptos.wd108.myworkdayjobs.com/Aptos"><meta property="og:title" content="Open Jobs"><meta property="og:description" content="Aptos is the global leader in unified commerce solutions for retailers">',
  },
  {
    module: insightsoftware,
    careers: '<h1>Current Job Openings</h1>Learn more about our high-energy, high-performance global team. Showing 0 of 0 No job openings available at the moment.',
    board: '<link rel="canonical" href="https://magnitudesoftware.wd1.myworkdayjobs.com/External"><meta property="og:title" content="Careers"><script src="cx-jobs.min.js"></script>tenant: "magnitudesoftware", siteId: "External", insightsoftware',
  },
  {
    module: itron,
    boardUrl: itron.INDIA_WORKDAY_URL,
    careers: '<title>Careers - Itron</title><a href="https://itron.wd5.myworkdayjobs.com/Itron?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e">View Jobs in India</a>',
    board: '<link rel="canonical" href="https://itron.wd5.myworkdayjobs.com/Itron"><script>window.workday = {tenant: "itron", siteId: "Itron"}</script>',
  },
  {
    module: lattice,
    boardUrl: lattice.OFFICIAL_WORKDAY_BOARD_URL,
    careersUrl: lattice.OFFICIAL_CAREERS_PAGE_URL,
    careers: '<title>Lattice Semiconductor | Careers | Join the FPGA Leader</title>Search Job Openings <a href="https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers">Apply Today</a>',
    board: '<link rel="canonical" href="https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers"><meta property="og:title" content="Join the FPGA Leader">tenant: "latticesemi", siteId: "latticesemiconductorscareers", requestLocale: "en-US", appName: "cxs"',
  },
  {
    module: newfold,
    board: '<link rel="canonical" href="https://web.wd1.myworkdayjobs.com/ExternalCareerSite"><meta property="og:title" content="Open Jobs">Search for Jobs',
  },
  {
    module: renault,
    homepage: 'Renault Group Careers <a href="https://www.renaultgroup.com/en/careers/">Careers</a>',
    careers: 'A career at the centre of the automotive revolution. Joining Renault Group means being part of a pioneering automotive company. Find your next job. <a href="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers">View our offers</a> ReKnow University',
    board: '<link rel="canonical" href="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers"><meta property="og:title" content="Careers | Renault Group"><meta property="og:url" content="https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers">',
  },
]

const responseAt = (url, html, init = {}) => {
  const response = new Response(html, init)
  Object.defineProperty(response, 'url', { value: url })
  return response
}

function harness(t, source, boardResponse, runOptions = {}, careersResponse) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.now() })
  t.after(() => {
    for (const state of workdayRequestScheduler.shards.values()) clearTimeout(state.timer)
    workdayRequestScheduler.shards.clear()
  })
  const boardUrl = source.boardUrl || source.module.WORKDAY_BOARD_URL
  const requests = []
  const downstream = new Error('verified board reached the native inventory reader')
  const nextStage = async () => { throw downstream }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options, at: Date.now() })
    if (url === boardUrl) return boardResponse(url, requests.filter(row => row.url === boardUrl).length)
    if (source.homepage && url === source.module.HOMEPAGE_URL) return responseAt(url, source.homepage)
    if (source.careers && url === (source.careersUrl || source.module.CAREERS_URL)) return careersResponse
      ? careersResponse(url) : responseAt(url, source.careers)
    throw new Error('Unexpected page request: ' + url)
  })
  const result = source.module.run({ fetchJson: nextStage, workdayRunner: nextStage, runWorkday: nextStage, ...runOptions })
    .then(value => ({ value }), error => ({ error }))
  return { boardUrl, requests, downstream, result, async settle() {
    for (let tick = 0; tick < 12; tick += 1) {
      await setImmediate()
      t.mock.timers.tick(2500)
    }
    return result
  } }
}

for (const source of sources) {
  test(source.module.SOURCE + ' preserves an already cancelled caller without making a page request', async t => {
    const controller = new AbortController()
    const reason = Object.freeze({ cancelled: source.module.SOURCE })
    controller.abort(reason)
    const reader = harness(t, source, url => responseAt(url, source.board), { signal: controller.signal })
    assert.equal((await reader.settle()).error, reason)
    assert.equal(reader.requests.length, 0)
  })

  test(source.module.SOURCE + ' healthy fixture reaches the existing native inventory reader', async t => {
    const reader = harness(t, source, url => responseAt(url, source.board))
    assert.equal((await reader.settle()).error, reader.downstream)
  })

  for (const status of [429, 503]) {
    test(source.module.SOURCE + ' recovers an ordinary HTTP ' + status + ' before native identity delegation', async t => {
      const reader = harness(t, source, (url, attempt) => attempt === 1
        ? responseAt(url, 'Please try again later', { status, headers: { 'retry-after': '2' } })
        : responseAt(url, source.board))
      const outcome = await reader.settle()
      assert.equal(outcome.error, reader.downstream, 'recovery must reach the unchanged identity-verified inventory path')
      const attempts = reader.requests.filter(row => row.url === reader.boardUrl)
      assert.equal(attempts.length, 2)
      assert.ok(attempts[1].at - attempts[0].at >= 2000, 'Retry-After must be respected')
    })
  }

  test(source.module.SOURCE + ' stops a declared HTTP 200 challenge before native delegation', async t => {
    const reader = harness(t, source, url => responseAt(url, source.board, { headers: { 'cf-mitigated': 'challenge' } }))
    const { error } = await reader.settle()
    assert.equal(error?.accessChallenge, true)
    assert.equal(error?.abortRetries, true)
    assert.equal(reader.requests.filter(row => row.url === reader.boardUrl).length, 1)
  })
}

test('custom Workday pages stop after three ordinary throttle responses', async t => {
  const reader = harness(t, sources[4], url => responseAt(url, 'Too many requests', { status: 429, headers: { 'retry-after': '0' } }))
  const { error } = await reader.settle()
  assert.equal(error?.httpStatus, 429)
  assert.equal(error?.abortRetries, true, 'the outer source loop must not multiply page retries')
  assert.equal(reader.requests.length, 3)
})

test('custom Workday pages recover an interrupted ordinary throttle body', async t => {
  const reader = harness(t, sources[4], (url, attempt) => {
    if (attempt > 1) return responseAt(url, sources[4].board)
    const response = responseAt(url, 'broken response', { status: 429, headers: { 'retry-after': '0' } })
    response.text = async () => { throw new TypeError('terminated') }
    return response
  })
  assert.equal((await reader.settle()).error, reader.downstream)
  assert.equal(reader.requests.length, 2)
})

for (const status of [200, 429, 503]) {
  test('custom Workday pages stop readable maintenance returned as HTTP ' + status, async t => {
    const reader = harness(t, sources[4], url => responseAt(url, 'Workday is currently unavailable', { status, headers: { 'retry-after': '0' } }))
    const { error } = await reader.settle()
    assert.equal(error?.name, 'WorkdayUpstreamOutageError')
    assert.equal(reader.requests.length, 1)
  })
}

test('custom Workday pages keep the source identity rejection after throttle recovery', async t => {
  const reader = harness(t, sources[4], (url, attempt) => attempt === 1
    ? responseAt(url, 'Too many requests', { status: 429, headers: { 'retry-after': '0' } })
    : responseAt(url, '<title>Unrelated employer</title>'))
  const { error } = await reader.settle()
  assert.match(error?.message || '', /verified public Workday board changed materially/)
  assert.equal(reader.requests.length, 2)
})

for (const [status, headers] of [[403, {}], [429, { 'x-amzn-waf-action': 'challenge' }]]) {
  test('custom Workday pages never retry HTTP ' + status + ' access denials', async t => {
    const reader = harness(t, sources[4], url => responseAt(url, 'Access denied', { status, headers }))
    const { error } = await reader.settle()
    assert.match(error?.message || '', /HTTP_403|HTTP 403|challenge/i)
    assert.equal(reader.requests.length, 1)
  })
}

for (const status of [200, 429, 503]) {
  test('custom Workday pages stop an explicit browser challenge in an HTTP ' + status + ' body', async t => {
    const reader = harness(t, sources[4], url => responseAt(url,
      '<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/check.js"></script>',
      { status, headers: { 'retry-after': '0' } }))
    const { error } = await reader.settle()
    assert.equal(error?.accessChallenge, true)
    assert.equal(error?.failureKind, 'blocked_or_access_denied')
    assert.equal(reader.requests.length, 1)
  })
}

test('insightsoftware stops a declared challenge on its corporate handoff page', async t => {
  const reader = harness(t, sources[1], url => responseAt(url, sources[1].board), {}, url =>
    responseAt(url, sources[1].careers, { status: 403, headers: { 'cf-mitigated': 'challenge' } }))
  assert.equal((await reader.settle()).error?.accessChallenge, true)
  assert.deepEqual(reader.requests.map(row => row.url), [insightsoftware.CAREERS_URL])
})

test('insightsoftware preserves an opaque cancellation during its corporate handoff read', async t => {
  const controller = new AbortController()
  const reason = Object.freeze({ get status() { throw new Error('Cancellation reason must remain opaque') } })
  const reader = harness(t, sources[1], url => responseAt(url, sources[1].board), { signal: controller.signal }, url => {
    controller.abort(reason)
    return responseAt(url, sources[1].careers)
  })
  assert.equal((await reader.settle()).error, reason)
  assert.deepEqual(reader.requests.map(row => row.url), [insightsoftware.CAREERS_URL])
})

const isolatedScheduler = t => {
  const scheduler = new WorkdayRequestScheduler({ minIntervalMs: 0, maxConcurrent: 1 })
  t.after(() => {
    for (const state of scheduler.shards.values()) clearTimeout(state.timer)
  })
  return scheduler
}

test('custom page Retry-After also delays native jobs API peers on the same shard', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const scheduler = isolatedScheduler(t)
  const pageUrl = 'https://page.wd998.myworkdayjobs.com/External'
  const peerUrl = 'https://peer.wd998.myworkdayjobs.com/wday/cxs/peer/External/jobs'
  const starts = []
  t.mock.method(globalThis, 'fetch', async url => {
    starts.push({ url, at: Date.now() })
    if (url === pageUrl) return responseAt(url, starts.length === 1 ? 'Try later' : '<title>Native board</title>', starts.length === 1
      ? { status: 429, headers: { 'retry-after': '2' } } : { headers: { 'content-type': 'text/html', 'x-page-evidence': 'retained' } })
    assert.equal(url, peerUrl)
    return Response.json({ total: 0, jobPostings: [] })
  })
  const pendingPage = fetchWorkdayPage(pageUrl, { requestScheduler: scheduler })
  await setImmediate()
  const pendingPeer = fetchWorkdayJobsApiPage({ jobsApiUrl: peerUrl, appliedFacets: {}, offset: 0, requestScheduler: scheduler })
  await setImmediate()
  assert.equal(starts.length, 1)
  t.mock.timers.tick(1999)
  await setImmediate()
  assert.equal(starts.length, 1, 'a peer API request cannot bypass the public-page server cooldown')
  t.mock.timers.tick(1)
  const [page, peer] = await Promise.all([pendingPage, pendingPeer])
  assert.deepEqual(starts.map(row => row.at), [0, 2000, 2000])
  assert.equal(page.html, '<title>Native board</title>')
  assert.equal(page.url, pageUrl)
  assert.equal(page.status, 200)
  assert.equal(page.contentType, 'text/html')
  assert.equal(page.headers.get('x-page-evidence'), 'retained')
  assert.deepEqual(peer.jobPostings, [])
})

test('a page HTTP-date Retry-After prevents an early retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.UTC(2026, 10, 27) })
  const starts = []
  const pending = fetchWorkdayPage('https://date.wd997.myworkdayjobs.com/External', {
    requestScheduler: isolatedScheduler(t),
    fetchImpl: async url => {
      starts.push(Date.now())
      return starts.length === 1
        ? responseAt(url, 'Try later', { status: 503, headers: { 'retry-after': 'Fri, 27 Nov 2026 00:00:03 GMT' } })
        : responseAt(url, 'Native board')
    },
  })
  await setImmediate()
  t.mock.timers.tick(2999)
  await setImmediate()
  assert.equal(starts.length, 1)
  t.mock.timers.tick(1)
  assert.equal((await pending).html, 'Native board')
  assert.deepEqual(starts, [1795737600000, 1795737603000])
})

test('a cancelled page cooldown removes its queued retry and preserves the opaque caller reason', async t => {
  const scheduler = isolatedScheduler(t)
  const controller = new AbortController()
  const reason = Object.freeze({ get status() { throw new Error('Opaque reason was inspected') } })
  const url = 'https://cancel.wd996.myworkdayjobs.com/External'
  let attempts = 0
  const pending = fetchWorkdayPage(url, {
    signal: controller.signal, requestScheduler: scheduler,
    fetchImpl: async () => {
      attempts += 1
      return responseAt(url, 'Try later', { status: 429, headers: { 'retry-after': '3600' } })
    },
  })
  const outcome = pending.then(value => ({ value }), error => ({ error }))
  await setImmediate()
  controller.abort(reason)
  assert.equal((await outcome).error, reason)
  assert.equal(attempts, 1)
  const state = scheduler.stateFor(url)
  assert.equal(state.active, 0)
  assert.equal(state.queue.length, 0)
  assert.equal(state.timer, null)
})

test('a failed error body retains its shard slot until owned disposal settles', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 })
  const scheduler = isolatedScheduler(t)
  const url = 'https://cleanup.wd995.myworkdayjobs.com/External'
  let finishDisposal, disposalCount = 0, attempts = 0
  const pending = fetchWorkdayPage(url, {
    requestScheduler: scheduler,
    fetchImpl: async () => {
      attempts += 1
      const response = responseAt(url, 'Native board', attempts === 1 ? { status: 429, headers: { 'retry-after': '0' } } : {})
      if (attempts === 1) {
        response.text = async () => { throw new TypeError('terminated') }
        t.mock.method(response.body, 'cancel', () => {
          disposalCount += 1
          return new Promise(resolve => { finishDisposal = resolve })
        })
      }
      return response
    },
  })
  await setImmediate()
  assert.equal(scheduler.stateFor(url).active, 1)
  assert.equal(attempts, 1)
  assert.equal(disposalCount, 1)
  finishDisposal()
  await setImmediate()
  assert.equal(scheduler.stateFor(url).active, 0)
  t.mock.timers.tick(1000)
  assert.equal((await pending).html, 'Native board')
  assert.equal(attempts, 2)
  assert.equal(disposalCount, 1)
  assert.equal(scheduler.stateFor(url).active, 0)
})

for (const status of [403, 404, 500]) {
  test('custom pages do not retry unsupported HTTP ' + status + ' failures', async t => {
    let attempts = 0
    await assert.rejects(fetchWorkdayPage('https://terminal.wd994.myworkdayjobs.com/External', {
      requestScheduler: isolatedScheduler(t),
      fetchImpl: async url => {
        attempts += 1
        const response = responseAt(url, 'Failure', { status })
        response.text = () => { throw new Error('A terminal response body must not be read') }
        return response
      },
    }), error => error.httpStatus === status && (status === 500 ? error.abortRetries !== true : error.abortRetries === true))
    assert.equal(attempts, 1)
  })
}

test('page transport failures preserve a frozen error without adding retry flags', async t => {
  const failure = Object.freeze(new TypeError('fetch failed: connection reset'))
  await assert.rejects(fetchWorkdayPage('https://frozen.wd993.myworkdayjobs.com/External', {
    requestScheduler: isolatedScheduler(t),
    fetchImpl: async () => { throw failure },
  }), error => error === failure)
})

test('page transport failures do not inspect an opaque rejected value', async t => {
  const failure = Object.freeze({ get httpStatus() { throw new Error('Opaque transport failure was inspected') } })
  await assert.rejects(fetchWorkdayPage('https://opaque.wd992.myworkdayjobs.com/External', {
    requestScheduler: isolatedScheduler(t),
    fetchImpl: async () => { throw failure },
  }), error => error === failure)
})

test('the existing outer retry can recover an ordinary page transport failure', async t => {
  const scheduler = isolatedScheduler(t)
  let attempts = 0
  const page = await withRetry(() => fetchWorkdayPage('https://outer.wd991.myworkdayjobs.com/External', {
    requestScheduler: scheduler,
    fetchImpl: async url => {
      attempts += 1
      if (attempts === 1) throw new TypeError('fetch failed: connection reset')
      return responseAt(url, 'Native board')
    },
  }), { attempts: 2, baseDelayMs: 0, label: 'page transport recovery' })
  assert.equal(page.html, 'Native board')
  assert.equal(attempts, 2)
})

test('the existing outer retry can recover a page request deadline', async t => {
  const scheduler = isolatedScheduler(t)
  let attempts = 0
  const page = await withRetry(() => fetchWorkdayPage('https://deadline.wd990.myworkdayjobs.com/External', {
    requestScheduler: scheduler, timeoutMs: 5,
    fetchImpl: async (url, { signal }) => {
      attempts += 1
      if (attempts === 1) return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
      return responseAt(url, 'Native board')
    },
  }), { attempts: 2, baseDelayMs: 0, label: 'page deadline recovery' })
  assert.equal(page.html, 'Native board')
  assert.equal(attempts, 2)
})
