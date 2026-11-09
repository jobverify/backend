import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('Kathir redesign identifies first-party pages while refusing unverified inline job geography', () => {
  assert.equal(scraper.hasOfficialHomepageSignal(fixture('kathir-home.html')), true)
  assert.equal(scraper.hasOfficialCareersSignal(fixture('kathir-career.html')), true)
  assert.throws(() => scraper.extractPublicJobs(fixture('kathir-career.html')), error => error.code === 'KATHIR_LOCATION_UNVERIFIED')
})

test('Kathir inline roles retain incomplete inventory evidence instead of verified zero', async () => {
  const jobs = await scraper.run({ fetchText: async url => fixture(url === scraper.HOMEPAGE_URL ? 'kathir-home.html' : 'kathir-career.html') })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.listingComplete, false)
  assert.match(evidence?.reason, /geography is unverified/)
})
