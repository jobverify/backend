import assert from 'node:assert/strict'
import test from 'node:test'
import * as script from './script.js'
import * as native from './nativeData20261115.js'
import {getScraperCatalog, createCatalogScraper} from '../../scraper-support/providers/index.js'

test('existing script factory/run and native entry preserve exact source identity and delegate one collector', () => {
  assert.equal(script.createKukuFMScraper, native.createKukuFMScraper)
  assert.equal(script.SOURCE, 'kukufm')
  assert.equal(script.COMPANY, 'Kuku FM')
  assert.equal(script.CAREERS_URL, 'https://kukuapp.in/careers/open-roles/')
  assert.equal(script.VERIFIED_ON, null)
})
for (const [name, start] of [
  ['factory', options => script.createKukuFMScraper().run(options)],
  ['script run', options => script.run(options)],
  ['native entry', options => native.run(options)],
  ['registered', options => createCatalogScraper(getScraperCatalog().find(row => row.source === 'kukufm')).run(options)],
]) {
  test(name + ' preserves preaborted opaque reason before validation or physical/fallback requests', async () => {
    const controller = new AbortController(), reason = Object.freeze({opaque: name})
    controller.abort(reason)
    let calls = 0
    await assert.rejects(() => start({signal: controller.signal, maxRequests: 47, fetchImpl: async () => {calls++}}), value => value === reason)
    assert.equal(calls, 0)
    assert.deepEqual(Reflect.ownKeys(reason), ['opaque'])
  })
  test(name + ' rejects metadata-free body callbacks before any original Response reads', async () => {
    let calls = 0
    await assert.rejects(() => start({fetchText: async () => '<title>Kuku FM</title>', fetchImpl: async () => {calls++}}), /Full original Response/)
    assert.equal(calls, 0)
  })
}
