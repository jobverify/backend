import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { run, CAREERS_URL, JOB_LISTINGS_URL } from '../../scraper/muvientertainment/script.js'
import { MUVI_ENTERTAINMENT_CATALOG } from '../../scraper/muvientertainment/catalog.js'
const dir = new URL('./fixtures/muvientertainment/', import.meta.url)
const home = await fs.readFile(new URL('current-careers.html', dir), 'utf8')
const listing = await fs.readFile(new URL('current-listing.html', dir), 'utf8')
const details = JSON.parse(await fs.readFile(new URL('current-details.json', dir), 'utf8'))

test('current remote-only Muvi inventory fails closed after checking every native application', async () => {
  const calls = []
  await assert.rejects(run({
    fetchText: async url => {
      calls.push(url)
      if (url === CAREERS_URL) return home
      if (url === JOB_LISTINGS_URL) return listing
      assert.ok(details[url], 'Unexpected URL '+url)
      return details[url]
    },
  }), /unverified India country scope/i)
  assert.equal(calls.length, 5)
  assert.deepEqual(calls.slice(2), Object.keys(details))
  assert.ok(Object.values(details).every(html => /<div class="location">Remote<\/div>/.test(html)))
  assert.ok(Object.values(details).every(html => /\+91[\s\S]{0,100}\(India\)[\s\S]{0,100}selected/.test(html)))
})
test('Muvi current metadata records three public roles and unknown India count without implying zero', () => {
  assert.equal(MUVI_ENTERTAINMENT_CATALOG.verifiedOn, '2026-10-09')
  assert.equal(MUVI_ENTERTAINMENT_CATALOG.verifiedPublicJobCount, 3)
  assert.equal(Object.hasOwn(MUVI_ENTERTAINMENT_CATALOG, 'verifiedIndiaJobCount'), false)
  assert.equal(MUVI_ENTERTAINMENT_CATALOG.verificationDisposition, 'public-remote-inventory-country-scope-unverified')
  assert.match(MUVI_ENTERTAINMENT_CATALOG.verifiedSurfaceSummary, /phone.*default/i)
  assert.match(MUVI_ENTERTAINMENT_CATALOG.verifiedSurfaceSummary, /fail.closed/i)
})
