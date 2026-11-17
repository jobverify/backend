import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../utils/fetch.js'
import { requireNativeHttpResponse } from '../shared/nativeHttpResponse.js'
import { fetchWorkdayJobsApiPage } from '../myworkday/engine.js'
import { classifyScraperError } from '../utils/failureClassification.js'
import { auditCurrentWorkdayRawScope } from '../shared/workdayCurrentSourceScope.js'
import { runCarrierNative, API as CARRIER_API } from '../../scraper/carrier.workday/nativeRun.js'

const URL = 'https://cleanup.wd503.myworkdayjobs.com/wday/cxs/cleanup/External/jobs'
const response = cancel => ({ status: 429, ok: false, url: URL, bodyUsed: false,
  headers: new Headers({ 'cf-mitigated': 'challenge', 'retry-after': '0', 'content-type': 'text/html' }), body: { cancel } })
const outcome = async work => {
  let timer
  try {
    return await Promise.race([work.then(value => ({ value }), error => ({ error })),
      new Promise(resolve => { timer = setTimeout(() => resolve({ stuck: true }), 1500) })])
  } finally { clearTimeout(timer) }
}
const denied = result => {
  assert.notEqual(result.stuck, true, 'HTTP denial cleanup must have a finite settlement')
  assert.equal(result.error?.status, 429)
  assert.equal(result.error?.httpStatus, 429)
  assert.equal(result.error?.abortRetries, true)
  assert.equal(classifyScraperError(result.error).failureKind, 'blocked_or_access_denied')
}

for (const [name, fetcher] of [['JSON', fetchJsonWithRetry], ['HTML', fetchTextWithRetry]]) {
  test('shared ' + name + ' preserves an observed challenge when local cleanup times out', async () => {
    let cancellations = 0, requests = 0
    const result = await outcome(fetcher(URL, { attempts: 3, baseDelayMs: 0, timeoutMs: 20, fetchImpl: async () => {
      requests++
      return response(() => { cancellations++; return new Promise(() => {}) })
    } }))
    denied(result)
    assert.equal(requests, 1)
    assert.equal(cancellations, 1)
  })
}

test('native HTTP validation preserves denial over an explicitly separate local deadline', async () => {
  let cancellations = 0
  denied(await outcome(requireNativeHttpResponse(response(() => { cancellations++; return new Promise(() => {}) }), URL, {
    signal: AbortSignal.timeout(20), callerSignal: null,
  })))
  assert.equal(cancellations, 1)
})

test('Workday challenge cleanup invokes cancellation once and releases the slot after its deadline', async t => {
  let cancellations = 0, releases = 0
  t.mock.method(globalThis, 'fetch', async () => response(() => { cancellations++; return new Promise(() => {}) }))
  const result = await outcome(fetchWorkdayJobsApiPage({ jobsApiUrl: URL, appliedFacets: {}, offset: 0,
    session: {}, requestTimeoutMs: 20, retryBaseDelayMs: 0,
    requestScheduler: { acquire: async () => () => { releases++ }, recordRateLimit() {} },
  }))
  denied(result)
  assert.equal(cancellations, 1)
  assert.equal(releases, 1)
})

test('Workday raw-scope requests without a caller retain denial through their local cleanup deadline', async t => {
  let cancellations = 0
  t.mock.method(globalThis, 'fetch', async () => response(() => { cancellations++; return new Promise(() => {}) }))
  denied(await outcome(auditCurrentWorkdayRawScope({ apiUrl: URL,
    boardUrl: 'https://cleanup.wd503.myworkdayjobs.com/External', schema: {}, requestTimeoutMs: 20,
  })))
  assert.equal(cancellations, 1)
})

for (const name of ['shared fetch', 'native HTTP', 'native HTTP legacy signal', 'Workday']) {
  test(name + ' preserves the exact opaque caller reason during challenge disposal', async t => {
    const caller = new AbortController()
    const reason = Object.freeze(Object.defineProperty(Object.create(null), 'message', { get() { throw Error('Opaque caller reason inspected') } }))
    let cancellations = 0
    const denial = () => response(() => {
      cancellations++
      queueMicrotask(() => caller.abort(reason))
      return new Promise(() => {})
    })
    let work
    if (name === 'shared fetch') work = fetchTextWithRetry(URL, { attempts: 3, timeoutMs: 1000, signal: caller.signal, fetchImpl: async () => denial() })
    else if (name.startsWith('native HTTP')) work = requireNativeHttpResponse(denial(), URL,
      name === 'native HTTP legacy signal' ? { signal: caller.signal } : { signal: AbortSignal.any([caller.signal, AbortSignal.timeout(1000)]), callerSignal: caller.signal })
    else {
      t.mock.method(globalThis, 'fetch', async () => denial())
      work = fetchWorkdayJobsApiPage({ jobsApiUrl: URL, appliedFacets: {}, offset: 0, session: {}, signal: caller.signal,
        requestTimeoutMs: 1000, requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} } })
    }
    const result = await outcome(work)
    assert.notEqual(result.stuck, true)
    assert.equal(result.error, reason)
    assert.equal(cancellations, 1)
  })
}

test('Carrier exported native collector preserves denial when its request race expires during cleanup', async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', ms => timeout(ms === 25000 ? 20 : ms))
  let cancellations = 0
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, CARRIER_API)
    return { ...response(() => { cancellations++; return new Promise(() => {}) }), url }
  })
  denied(await outcome(runCarrierNative({ signal: new AbortController().signal, now: new Date().toISOString() })))
  assert.equal(cancellations, 1)
})

for (const stage of ['headers', 'successful response body']) test('Carrier preserves its request deadline during pending ' + stage, async t => {
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal, 'timeout', ms => timeout(ms === 25000 ? 20 : ms))
  t.mock.method(globalThis, 'fetch', async url => stage === 'headers' ? new Promise(() => {}) : {
    status: 200, ok: true, url, headers: new Headers({ 'content-type': 'application/json' }), json: () => new Promise(() => {}),
  })
  const result = await outcome(runCarrierNative({ signal: new AbortController().signal, now: new Date().toISOString() }))
  assert.notEqual(result.stuck, true)
  assert.equal(result.error?.name, 'TimeoutError')
})

test('Carrier exported native collector preserves opaque caller cancellation during denial cleanup', async t => {
  const caller = new AbortController(), reason = Object.freeze(Object.create(null))
  let cancellations = 0
  t.mock.method(globalThis, 'fetch', async url => ({ ...response(() => {
    cancellations++
    queueMicrotask(() => caller.abort(reason))
    return new Promise(() => {})
  }), url }))
  const result = await outcome(runCarrierNative({ signal: caller.signal, now: new Date().toISOString() }))
  assert.notEqual(result.stuck, true)
  assert.equal(result.error, reason)
  assert.equal(cancellations, 1)
})
