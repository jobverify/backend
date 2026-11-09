import assert from 'node:assert/strict'
import test from 'node:test'

import { createBrowserFetchSession } from '../shared/browserFetch.js'

const URL = 'https://careers.example.test/jobs'
const reasonFor = label => Object.freeze(Error('caller timed out: ' + label))
const response = (html = 'native body', extra = {}) => ({
  ok: true, status: 200, url: URL, headers: new Headers({ 'content-type': 'text/html' }),
  text: async () => html, ...extra,
})
const methods = ['fetchText', 'fetchPage', 'fetchFinalUrl', 'fetchJson']

test('compatibility session rejects an already cancelled session caller before any HTTP request', async t => {
  const reason = reasonFor('session admission')
  t.mock.method(globalThis, 'fetch', async () => assert.fail('cancelled session must not fetch'))
  await assert.rejects(createBrowserFetchSession({ signal: AbortSignal.abort(reason) }), error => error === reason)
})

for (const method of methods) {
  test(`compatibility ${method} rejects a pre-aborted request before native HTTP or a landing request`, async t => {
    const reason = reasonFor(method), session = await createBrowserFetchSession()
    let calls = 0
    t.mock.method(globalThis, 'fetch', async () => { calls += 1; throw Error('unexpected HTTP') })
    await assert.rejects(session[method](URL, { signal: AbortSignal.abort(reason), landingUrl: URL + '/landing' }), error => error === reason)
    assert.equal(calls, 0)
  })

  for (const caller of ['session', 'request']) {
    test(`compatibility ${method} composes ${caller} cancellation and retains its frozen reason after a replaced fetch error`, async t => {
      const sessionCaller = new AbortController(), requestCaller = new AbortController(), reason = reasonFor(method + caller)
      const session = await createBrowserFetchSession({ signal: sessionCaller.signal })
      let calls = 0
      t.mock.method(globalThis, 'fetch', async (_url, options) => {
        calls += 1
        ;(caller === 'session' ? sessionCaller : requestCaller).abort(reason)
        assert.equal(options.signal?.aborted, true)
        throw Error('transport replaced the caller abort')
      })
      await assert.rejects(session[method](URL, { signal: requestCaller.signal }), error => error === reason)
      assert.equal(calls, 1)
      assert.equal((caller === 'session' ? requestCaller : sessionCaller).signal.aborted, false)
      assert.equal(Object.isFrozen(reason), true)
    })
  }

  test(`compatibility ${method} checks cancellation after uncooperative HTTP headers before reading a body`, async t => {
    const controller = new AbortController(), reason = reasonFor(method + ' headers'), session = await createBrowserFetchSession({ signal: controller.signal })
    let bodyReads = 0
    t.mock.method(globalThis, 'fetch', async () => {
      controller.abort(reason)
      return response('{"jobs":[]}', { text: async () => { bodyReads += 1; return '{"jobs":[]}' } })
    })
    await assert.rejects(session[method](URL), error => error === reason)
    assert.equal(bodyReads, 0)
  })
}

for (const method of ['fetchText', 'fetchPage', 'fetchJson']) {
  for (const caller of ['session', 'request']) {
    test(`compatibility ${method} checks ${caller} cancellation after an uncooperative body and cannot return empty success`, async t => {
      const controller = new AbortController(), reason = reasonFor(method + ' body ' + caller)
      const session = await createBrowserFetchSession(caller === 'session' ? { signal: controller.signal } : {})
      t.mock.method(globalThis, 'fetch', async () => response('{"jobs":[]}', { text: async () => {
        controller.abort(reason)
        return '{"jobs":[]}'
      } }))
      await assert.rejects(session[method](URL, caller === 'request' ? { signal: controller.signal } : {}), error => error === reason)
    })
  }
}

test('compatibility PDF body cancellation cannot be swallowed into an empty extraction', async t => {
  const controller = new AbortController(), reason = reasonFor('PDF body'), session = await createBrowserFetchSession({ signal: controller.signal })
  t.mock.method(globalThis, 'fetch', async () => response('', {
    headers: new Headers({ 'content-type': 'application/pdf' }),
    arrayBuffer: async () => { controller.abort(reason); throw Error('replaced body abort before PDF parsing') },
  }))
  await assert.rejects(session.fetchText(URL), error => error === reason)
})

test('compatibility final URL checks cancellation after metadata is read', async t => {
  const controller = new AbortController(), reason = reasonFor('final URL'), session = await createBrowserFetchSession({ signal: controller.signal })
  t.mock.method(globalThis, 'fetch', async () => response('', { get url() { controller.abort(reason); return URL } }))
  await assert.rejects(session.fetchFinalUrl(URL), error => error === reason)
})

test('compatibility default timeout remains 60000ms and its actual timeout reason survives replacement', async t => {
  const controller = new AbortController(), timeoutReason = Object.freeze(new DOMException('native request timed out', 'TimeoutError')), observed = []
  t.mock.method(AbortSignal, 'timeout', ms => { observed.push(ms); return controller.signal })
  t.mock.method(globalThis, 'fetch', async () => { controller.abort(timeoutReason); throw Error('transport replaced timeout') })
  const session = await createBrowserFetchSession()
  await assert.rejects(session.fetchText(URL), error => error === timeoutReason)
  assert.deepEqual(observed, [60000])
})

test('compatibility configured timeout does not abort either caller controller', async t => {
  const timeout = new AbortController(), sessionCaller = new AbortController(), requestCaller = new AbortController()
  const timeoutReason = Object.freeze(new DOMException('configured request timed out', 'TimeoutError')), observed = []
  t.mock.method(AbortSignal, 'timeout', ms => { observed.push(ms); return timeout.signal })
  t.mock.method(globalThis, 'fetch', async () => { timeout.abort(timeoutReason); throw Error('replaced timeout') })
  const session = await createBrowserFetchSession({ signal: sessionCaller.signal, timeoutMs: 1234 })
  await assert.rejects(session.fetchText(URL, { signal: requestCaller.signal }), error => error === timeoutReason)
  assert.deepEqual(observed, [1234])
  assert.equal(sessionCaller.signal.aborted, false)
  assert.equal(requestCaller.signal.aborted, false)
})

test('compatibility caller abort during the existing settle wait prevents all body work', async t => {
  const controller = new AbortController(), reason = reasonFor('settle'), session = await createBrowserFetchSession({ signal: controller.signal, settleTimeMs: 60 })
  let bodyReads = 0
  t.mock.method(globalThis, 'fetch', async () => {
    setTimeout(() => controller.abort(reason), 1)
    return response('', { text: async () => { bodyReads += 1; return '' } })
  })
  await assert.rejects(session.fetchText(URL), error => error === reason)
  assert.equal(bodyReads, 0)
})

test('compatibility cancellation in one session cannot stop a separate session', async t => {
  const callerA = new AbortController(), callerB = new AbortController(), reason = reasonFor('session A')
  const a = await createBrowserFetchSession({ signal: callerA.signal }), b = await createBrowserFetchSession({ signal: callerB.signal })
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/a')) { callerA.abort(reason); throw Error('replaced A abort') }
    return response('independent B')
  })
  await assert.rejects(a.fetchText(URL + '/a'), error => error === reason)
  assert.equal(await b.fetchText(URL + '/b'), 'independent B')
  assert.equal(callerB.signal.aborted, false)
})

test('compatibility signal composition preserves existing method/body/header/referer and landing semantics', async t => {
  const controller = new AbortController(), requests = []
  const session = await createBrowserFetchSession({ signal: controller.signal, userAgent: 'Existing caller agent' })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, method: options.method, headers: options.headers, body: options.body, redirect: options.redirect })
    return response('{"jobs":[]}', { headers: new Headers({ 'content-type': 'application/json' }) })
  })
  assert.deepEqual(await session.fetchJson(URL, { method: 'POST', body: '{"request":1}',
    headers: { Accept: 'application/json' }, referer: 'https://careers.example.test/', landingUrl: URL + '/landing' }), { jobs: [] })
  assert.deepEqual(requests, [URL + '/landing', URL].map(url => ({ url, method: 'POST', body: '{"request":1}', redirect: undefined,
    headers: { 'User-Agent': 'Existing caller agent', Accept: 'application/json', Referer: 'https://careers.example.test/' } })))
  assert.equal(controller.signal.aborted, false)
})
