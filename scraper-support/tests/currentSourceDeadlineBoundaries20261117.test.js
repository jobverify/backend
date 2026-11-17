import assert from 'node:assert/strict'
import test from 'node:test'
import {currentAmeyoTransport} from '../../scraper/ameyo/currentTransport20261117.js'
import {currentGmmcoTransport} from '../../scraper/gmmco/currentTransport20261117.js'
import {currentGenworxTransport} from '../../scraper/genworx/currentTransport20261117.js'
import {currentKaniniTransport} from '../../scraper/kanini/currentTransport20261117.js'

const factories = {ameyo: currentAmeyoTransport, gmmco: currentGmmcoTransport,
  genworx: currentGenworxTransport, kanini: currentKaniniTransport}

for (const [source, create] of Object.entries(factories)) {
  test(`${source} source deadline survives synchronous transport work before timer dispatch`, async () => {
    const url = 'https://deadline.example/read'
    let calls = 0
    const io = create({allowedURL: () => true, allowedRequest: () => true,
      timeoutMs: 20, requestIntervalMs: 0, fetchImpl: async () => {
        calls++
        const started = performance.now()
        while (performance.now() - started < 50) { /* Reproduce an unserviced timer. */ }
        return Object.defineProperty(new Response('original', {headers: {'content-type': 'text/html'}}),
          'url', {value: url})
      }})
    try {
      await assert.rejects(io.read(url), error => /source deadline exceeded/.test(error.message))
      assert.equal(calls, 1)
    } finally { io.close() }
  })

  for (const status of [200, 403]) {
    test(`${source} elapsed request deadline preserves observed HTTP ${status} priority`, async t => {
      const url = 'https://deadline.example/read'
      let clock = 0, calls = 0
      t.mock.method(performance, 'now', () => clock)
      const io = create({allowedURL: () => true, allowedRequest: () => true,
        timeoutMs: 60000, requestIntervalMs: 0, fetchImpl: async () => {
          calls++
          clock = 30000
          return Object.defineProperty(new Response('original', {status, headers: {'content-type': 'text/html'}}),
            'url', {value: url})
        }})
      try {
        await assert.rejects(io.read(url), error => status === 403
          ? error.httpStatus === 403 && error.failureKind === 'blocked_or_access_denied'
          : error.name === 'TimeoutError' && /request deadline exceeded/.test(error.message))
        assert.equal(calls, 1)
      } finally { io.close() }
    })
  }
}
