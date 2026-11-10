import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, buildIndiaSearchUrl } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packet = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/public-role.json.gz', import.meta.url))))
// Derived one-card listing isolates the genuinely captured native detail.
const listing = `<html><title>Safran - Résultat de votre recherche (1 offres, page 1) / Country : Asie-->Inde</title>
  <a href="../handlers/offerRss.ashx?lcid=1036&amp;Rss_Country=81">RSS</a>
  <span id="ctl00_ctl00_corpsRoot_corps_Pagination_TotalOffers">1 offre(s)</span>${packet.card}</html>`
const execute = change => run({ fetchText: async url => {
  if (url === buildIndiaSearchUrl(1)) return listing
  assert.equal(url, packet.requestUrl)
  return change ? change(packet.body) : packet.body
} })

test('current SDS div criteria retain the full role instead of failing the India cohort', async () => {
  const jobs = await execute()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '186333')
  assert.equal(jobs[0].country, 'India')
  assert.ok(jobs[0].jobDescription.length > 200)
  assert.match(jobs[0].jobDescription, /Mandatory Skills/)
  assert.match(jobs[0].jobDescription, /Knowledge of Signal Processing/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('SDS cannot publish hidden native criteria', async () => {
  await assert.rejects(execute(html => html.replace('id="fldjobdescription_description1"', 'hidden id="fldjobdescription_description1"')), /missing native|hidden native/)
})

test('SDS cannot silently discard a hidden mandatory subtree inside its description', async () => {
  await assert.rejects(execute(html => html.replace(/(<div\b[^>]*id="fldjobdescription_description1"[^>]*>)/,
    '$1<span hidden>Additional mandatory qualification</span>')), /hidden native/)
})
