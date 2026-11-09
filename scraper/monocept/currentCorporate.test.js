import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { corporateContract } from './nativeContract.js'
import { run } from './script.js'
import { nativeOptions } from './fixtures/options.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const read = name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}-20261028.json.gz`, import.meta.url))))
const corporate = read('corporate'), css = read('corporate-css')
test('Monocept accepts reviewed current Webflow navigation styles while retaining the visible employer handoff', () => {
  assert.deepEqual(corporateContract(corporate.body, css.body).reasons, [])
})
test('Monocept fetches and validates only the CSS advertised by the current corporate page', async () => {
  const options = nativeOptions(), calls = [], fetchImpl = async (url, init) => {
    calls.push(url)
    if (url === css.url) return { status: 200, url, body: css.body, contentType: 'text/css' }
    const packet = await options.fetchImpl(url, init)
    return url === corporate.url ? { ...packet, html: corporate.body, text: async () => corporate.body } : packet
  }
  const jobs = await run({ ...options, fetchImpl })
  assert.equal(jobs.length, 7)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(calls.filter(url => url === css.url).length, 2)
  assert.equal(calls.some(url => url.includes('d9e7abae8.opt.min.css')), false)
})
