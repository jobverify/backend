import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('GxP redesign validates linked client careers as explicitly not actively recruiting', async () => {
  const home = fixture('gxp-home.html')
  assert.equal(scraper.hasOfficialHomepageSignal(home), true)
  const requested = []
  const jobs = await scraper.run({ fetchText: async url => { requested.push(url); return url.endsWith('.js') ? fixture('gxp-careers-client.js') : home } })
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'verified-empty')
  assert.equal(evidence?.firstParty, true)
  assert.equal(evidence?.listingComplete, true)
  assert.equal(evidence?.reportedTotal, 0)
  assert.equal(evidence?.indiaFacetCount, 0)
  assert.ok(evidence?.pagesFetched >= 1 && Number.isFinite(Date.parse(evidence?.verifiedAt)))
  assert.ok(requested.some(url => url.endsWith('/assets/main-CDppGB14.js')))
})

test('GxP does not treat the static shell as evidence when client recruiting changes', async () => {
  await assert.rejects(scraper.run({ fetchText: async url => url.endsWith('.js') ? fixture('gxp-careers-client.js') + 'Current Openings JobPosting' : fixture('gxp-home.html') }), /client careers/)
  assert.equal(scraper.hasOfficialHomepageSignal(fixture('gxp-home.html').replaceAll('support@gxptechnologies.com', 'support@example.org')), false)
})
