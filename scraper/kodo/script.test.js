import assert from 'node:assert/strict'
import test from 'node:test'
import * as script from './script.js'
import * as native from './native.js'
import * as current from './currentNative.js'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'

test('Kodo existing factory and native entry share the same collector and original employer identity', () => {
  assert.equal(script.createKodoScraper, current.createKodoScraper)
  assert.equal(native.createKodoScraper, current.createKodoScraper)
  assert.equal(native.run, current.run)
  assert.equal(script.SOURCE, 'kodo')
  assert.equal(script.COMPANY, 'Kodo')
  assert.equal(script.CAREERS_URL, 'https://www.kodo.com/careers')
  assert.equal(script.VERIFIED_ON, null)
})
for (const [name, start] of [
  ['factory', options => script.createKodoScraper().run(options)],
  ['run', options => script.run(options)],
  ['native', options => native.run(options)],
  ['registered', options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'kodo')).run(options)],
]) {
  test(name + ' preserves preaborted opaque cancellation with zero physical/fallback reads', async () => {
    const control = new AbortController(), reason = Object.freeze({opaque: name})
    control.abort(reason)
    let calls = 0
    await assert.rejects(() => start({signal: control.signal, fetchImpl: async () => {calls++}}), error => error === reason)
    assert.equal(calls, 0)
  })
  test(name + ' rejects body-only injection before original transport or fallback', async () => {
    let calls = 0
    await assert.rejects(() => start({fetchText: async () => '<title>Kodo</title>', fetchImpl: async () => {calls++}}), /original Response/)
    assert.equal(calls, 0)
  })
}
