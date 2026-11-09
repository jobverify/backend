import assert from 'node:assert/strict'
import test from 'node:test'

import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'

const names = ['aeon', 'airteldigital', 'airtelpaymentsbank', 'airtelxlabs', 'asteriaaerospace',
  'bataindia', 'bharatdynamics', 'biocon', 'codevicesolutionpvtltd', 'deprontoinfotech',
  'fivestarbusinessfinance', 'indigo', 'khatabook', 'lakechemicalspvtltd', 'mckinseycompany',
  'nurturefarm', 'spiretechnologies', 'srei', 'stridespharma', 'technotreon']
const providers = new Map(getScraperCatalog().filter(provider => names.includes(provider.source)).map(provider => [provider.source, provider]))
const reasonFor = source => Object.freeze(Error('controlled caller timed out: ' + source))
const unexpected = () => Object.assign(Error('Caller signal did not reach the controlled native boundary'), { abortRetries: true })
const nativeResponse = (url, read) => ({ ok: true, status: 200, url: String(url),
  headers: new Headers({ 'content-type': 'text/html' }), text: read })

for (const source of names) {
  const registered = () => {
    const provider = providers.get(source)
    assert.equal(provider?.adapter, 'script')
    assert.match(provider.modulePath.replaceAll('\\', '/'), new RegExp('/scraper/' + source + '/script\\.js$'))
    return createCatalogScraper(provider)
  }

  test(`${source} registered runtime rejects the exact frozen caller reason before any native HTTP`, async t => {
    const reason = reasonFor(source), scraper = registered()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async () => { requests += 1; throw unexpected() })
    await assert.rejects(scraper.run({ signal: AbortSignal.abort(reason) }), error => error === reason)
    assert.equal(requests, 0)
  })

  test(`${source} registered default HTTP composes caller cancellation and restores a replaced in-flight abort`, async t => {
    const controller = new AbortController(), reason = reasonFor(source), scraper = registered()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async (_url, options = {}) => {
      requests += 1
      controller.abort(reason)
      if (!options.signal?.aborted) throw unexpected()
      throw Error('Native transport replaced the abort exception')
    })
    await assert.rejects(scraper.run({ signal: controller.signal }), error => error === reason)
    assert.equal(requests, 1)
  })

  test(`${source} registered runtime checks an uncooperative header result before starting a body read`, async t => {
    const controller = new AbortController(), reason = reasonFor(source), scraper = registered()
    let requests = 0, bodies = 0
    t.mock.method(globalThis, 'fetch', async url => {
      requests += 1
      controller.abort(reason)
      return nativeResponse(url, async () => { bodies += 1; return 'uncooperative body after caller abort' })
    })
    await assert.rejects(scraper.run({ signal: controller.signal }), error => error === reason)
    assert.equal(requests, 1)
    assert.equal(bodies, 0)
  })

  test(`${source} registered runtime checks cancellation after an uncooperative body before parsing or emitting`, async t => {
    const controller = new AbortController(), reason = reasonFor(source), scraper = registered()
    let requests = 0, bodies = 0
    t.mock.method(globalThis, 'fetch', async url => {
      requests += 1
      const read = () => { bodies += 1; controller.abort(reason); return 'invalid native content returned after caller cancellation' }
      if (source !== 'lakechemicalspvtltd') return nativeResponse(url, async () => read())
      // Lake's bounded transport consumes the original byte stream, not .text().
      const response = new Response(new ReadableStream({ pull(stream) {
        stream.enqueue(new TextEncoder().encode(read())); stream.close()
      } }, { highWaterMark: 0 }), { headers: { 'content-type': 'text/html' } })
      Object.defineProperty(response, 'url', { value: String(url) })
      return response
    })
    await assert.rejects(scraper.run({ signal: controller.signal }), error => error === reason)
    assert.equal(requests, 1)
    assert.equal(bodies, 1)
  })
}
