import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCanonIndiaScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const fetchPage = async url => {
  const row = captures.find(row => row.requestedUrl === url)
  assert.ok(row, 'unrecorded request ' + url)
  return { status: row.status, url: row.finalUrl, html: row.html }
}

test('reconciles all thirteen current Canon Asia roles after Malaysia joins the foreign inventory', async () => {
  const jobs = await createCanonIndiaScraper().run({ fetchPage })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 13)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 0)
  assert.equal(readInventoryEvidence(jobs)?.pagesFetched, 3)
})

test('never verifies an empty India inventory when a native Canon role moves into India', async () => {
  await assert.rejects(createCanonIndiaScraper().run({ fetchPage: async url => {
    const page = await fetchPage(url)
    if (url.includes('recruitingCEJobRequisitions') && url.endsWith('offset=0')) {
      const payload = JSON.parse(page.html)
      payload.items[0].requisitionList[0].PrimaryLocationCountry = 'IN'
      payload.items[0].requisitionList[0].PrimaryLocation = 'Bengaluru'
      page.html = JSON.stringify(payload)
    }
    return page
  } }), /inventory|India/)
})

test('keeps unknown native country codes unresolved instead of certifying foreign inventory', async () => {
  await assert.rejects(createCanonIndiaScraper().run({ fetchPage: async url => {
    const page = await fetchPage(url)
    if (url.includes('recruitingCEJobRequisitions') && url.endsWith('offset=0')) {
      const payload = JSON.parse(page.html)
      payload.items[0].requisitionList[0].PrimaryLocationCountry = 'ZZ'
      payload.items[0].requisitionList[0].PrimaryLocation = 'Unspecified office'
      page.html = JSON.stringify(payload)
    }
    return page
  } }), /inventory|country/i)
})
