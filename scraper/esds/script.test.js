import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { CAREERS_URL, createEsdsScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

test('ESDS missing current corporate inventory cannot authorize an empty result or a native API fallback', async () => {
  const careers = await fs.readFile(new URL('./fixtures/careers-20261026.html', import.meta.url), 'utf8')
  const noCards = careers.replace(/window\.location=/g, 'data.retiredRoute=')
  const calls = []
  let evidence
  const jobs = await createEsdsScraper().run({
    fetchPage: async url => { calls.push(url); return { status: 200, url, text: noCards } },
    fetchListingPage: () => assert.fail('Retired native API fallback must not execute'),
    onSourceEvidence: value => { evidence = value },
  })
  assert.equal(jobs.length, 0)
  assert.equal(calls[0], CAREERS_URL)
  assert.equal(evidence.advertisedCandidates.length, 0)
  assert.ok(evidence.issues.includes('corporate-candidates-missing-or-changed'))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
