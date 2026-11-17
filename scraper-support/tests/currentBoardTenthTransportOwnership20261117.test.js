import assert from 'node:assert/strict'
import test from 'node:test'
import {createManthanScraper} from '../../scraper/manthan/script.js'
import {createPepperfryScraper} from '../../scraper/pepperfry/script.js'
import {createSattvaMediaScraper} from '../../scraper/sattvamedia/script.js'

for (const [source, create, legacy] of [['manthan', createManthanScraper, 'fetchPage'],
  ['pepperfry', createPepperfryScraper, 'fetchPage'], ['sattvamedia', createSattvaMediaScraper, 'fetchText']]) {
  test(source + ' runtime rejects legacy transports before callbacks or unbound network', async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Unbound network forbidden'))
    for (const key of [legacy, 'fetchJson', 'fetchProtocolTolerantText', 'fetchBrowserText', 'probeUrl']) {
      for (const withNative of [false, true]) {
        let legacyReads = 0, nativeReads = 0
        const options = {[key]: async () => { legacyReads++; return {status: 200, html: 'Historical publisher'} }}
        if (withNative) options.fetchImpl = async url => {
          nativeReads++
          return Object.defineProperty(new Response('denied', {status: 403}), 'url', {value: url})
        }
        if (withNative) await assert.rejects(create().run(options), error => (error.status ?? error.httpStatus) === 403)
        else await assert.rejects(create().run(options), /Unsupported legacy recruitment transport; original HTTP fetchImpl required/)
        assert.equal(legacyReads, 0)
        assert.equal(nativeReads, withNative ? 1 : 0)
      }
    }
    for (const reason of [Object.freeze({owner: source}), null]) {
      const caller = new AbortController()
      caller.abort(reason)
      await assert.rejects(create().run({signal: caller.signal, [legacy]: () => assert.fail('Cancelled callback')}),
        error => error === reason)
    }
  })
}
