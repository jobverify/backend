import assert from 'node:assert/strict'
import test from 'node:test'

import * as aeon from './script.js'
import * as digital from '../airteldigital/script.js'
import * as payments from '../airtelpaymentsbank/script.js'
import * as xlabs from '../airtelxlabs/script.js'
import * as asteria from '../asteriaaerospace/script.js'
import * as bata from '../bataindia/script.js'

const cases = [
  ['aeon', aeon, 'fetchPage', 'fetchBrowserPage'],
  ['airteldigital', digital, 'fetchText', 'fetchBrowserText'],
  ['airtelpaymentsbank', payments, 'fetchText', 'fetchBrowserText'],
  ['airtelxlabs', xlabs, 'fetchPage', 'fetchBrowserPage'],
  ['asteriaaerospace', asteria, 'fetchText', 'fetchBrowserText'],
]
const reasonFor = source => Object.freeze(Error('controlled caller timed out: ' + source))
// Cancellation controls must reach an allowed transport fallback. An HTTP
// denial is a terminal source response and has separate no-fallback coverage.
const upstreamFailure = () => Object.assign(Error('fetch failed controlled upstream transport'), { abortRetries: true })
const htmlAfterAbort = '<title>Explore Career Opportunities | Asteria</title><h1>Careers</h1>'
  + '<p>Make the right move. Join us. Write to us at careers@asteria.co.in</p>'
const response = (url, text) => ({ ok: true, status: 200, url, headers: new Headers({ 'content-type': 'text/html' }), text })

for (const [source, module, primary, browser] of cases) {
  test(`${source} injected source-timeout error never starts a browser fallback`, async () => {
    const controller = new AbortController(), reason = reasonFor(source)
    let browserCalls = 0, primaryCalls = 0
    await assert.rejects(module.run({ signal: controller.signal,
      [primary]: async (_url, options) => {
        primaryCalls++
        assert.equal(options.signal, controller.signal)
        controller.abort(reason)
        throw reason
      }, [browser]: async () => { browserCalls++; return htmlAfterAbort },
    }), error => error === reason)
    assert.equal(primaryCalls, 1)
    assert.equal(browserCalls, 0)
  })

  test(`${source} injected browser result cannot turn cancellation into success or a parser failure`, async () => {
    const controller = new AbortController(), reason = reasonFor(source)
    let browserCalls = 0
    await assert.rejects(module.run({ signal: controller.signal,
      [primary]: async () => { throw upstreamFailure() },
      [browser]: async (url, options) => {
        browserCalls++
        assert.equal(options.signal, controller.signal)
        controller.abort(reason)
        return browser === 'fetchBrowserPage' ? { status: 200, url, html: htmlAfterAbort } : htmlAfterAbort
      },
    }), error => error === reason)
    assert.equal(browserCalls, 1)
  })

  for (const stage of ['inflight', 'headers', 'body']) {
    test(`${source} default compatibility browser HTTP preserves caller abort at ${stage}`, async t => {
      const controller = new AbortController(), reason = reasonFor(source)
      let requests = 0, bodies = 0
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests++
        if (requests === 1) throw upstreamFailure()
        assert.equal(requests, 2, 'cancelled fallback must not start another HTTP attempt')
        if (stage !== 'body') controller.abort(reason)
        assert.equal(Boolean(options.signal?.aborted), stage !== 'body')
        if (stage === 'inflight') throw Error('compatibility transport replaced the native abort')
        return response(url, async () => {
          bodies++
          if (stage === 'body') controller.abort(reason)
          return htmlAfterAbort
        })
      })
      await assert.rejects(module.run({ signal: controller.signal }), error => error === reason)
      assert.equal(requests, 2)
      assert.equal(bodies, stage === 'body' ? 1 : 0)
    })
  }
}

for (const status of [401, 403, 429, 451]) {
  test(`asteriaaerospace injected HTTP ${status} denial never starts a browser fallback`, async () => {
    const denied = Object.assign(Error(`HTTP ${status} controlled upstream denial`), { status })
    let reads = 0, browserCalls = 0
    await assert.rejects(asteria.run({ fetchText: async () => { reads++; throw denied },
      fetchBrowserText: async () => { browserCalls++; return htmlAfterAbort },
    }), error => error === denied)
    assert.equal(reads, 1)
    assert.equal(browserCalls, 0)
  })

  test(`asteriaaerospace native HTTP ${status} denial never starts a browser fallback`, async t => {
    let requests = 0, browserCalls = 0
    t.mock.method(globalThis, 'fetch', async url => {
      requests++
      return { ok: false, status, url, headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => 'Controlled public source denial' }
    })
    await assert.rejects(asteria.run({ fetchBrowserText: async () => { browserCalls++; return htmlAfterAbort } }),
      error => new RegExp(`HTTP ${status}\\b`).test(error.message))
    assert.equal(requests, 1)
    assert.equal(browserCalls, 0)
  })
}

test('Payments Bank guarded 403 catch never absorbs a caller reason with the same native status', async () => {
  const controller = new AbortController(), reason = Object.freeze(Object.assign(Error('HTTP 403 caller timed out'), { status: 403 }))
  let reads = 0, browserCalls = 0
  await assert.rejects(payments.run({ signal: controller.signal, fetchText: async () => {
    reads++; controller.abort(reason); throw reason
  }, fetchBrowserText: async () => { browserCalls++; return '' } }), error => error === reason)
  assert.equal(reads, 1)
  assert.equal(browserCalls, 0)
})

test('Bata optional homepage timeout catch stops before reading the jobs board after caller abort', async () => {
  const controller = new AbortController(), reason = reasonFor('bataindia')
  let reads = 0
  await assert.rejects(bata.run({ signal: controller.signal, fetchText: async () => {
    reads++; controller.abort(reason); throw reason
  } }), error => error === reason)
  assert.equal(reads, 1)
})
