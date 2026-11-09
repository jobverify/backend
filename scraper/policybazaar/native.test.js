import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createPolicybazaarScraper, extractSearchResults, extractHiringCities, hasSharedApplicationFormSignal } from './script.js'

const packet = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/official-responses.json.gz', import.meta.url))))
const page = packet.responses.find(r => r.url === 'https://www.policybazaar.com/careers/')

test('captured current first-party HTTP page retains four observations without inventing locatable vacancies', async () => {
  assert.equal(page.status, 200)
  assert.equal(page.finalUrl, 'https://www.policybazaar.com/careers/')
  assert.equal(hasSharedApplicationFormSignal(page.body), true)
  assert.deepEqual(extractHiringCities(page.body), ['Gurugram', 'Mumbai', 'Pune', 'Kolkata', 'Chennai', 'Bangalore', 'Hyderabad'])
  const cards = extractSearchResults(page.body)
  assert.deepEqual(cards.map(card => card.title), ['Associate Sales Consultant', 'Associate Service Consultant', 'Relationship Manager', 'Careers in Technology'])
  assert.ok(cards.every(card => card.country === null && card.location === null && card.requisitionId === null && card.postingDate === null && card.closingDate === null))
  assert.ok(cards.every(card => card.jobDescription && card.sourceDetailComplete === false))
  await assert.rejects(createPolicybazaarScraper().run({ fetchImpl: async url => {
    assert.equal(url, 'https://www.policybazaar.com/careers/')
    const response=new Response(page.body,{status:page.status});Object.defineProperty(response,'url',{value:page.finalUrl});return response
  } }), error => {
    assert.equal(error.code, 'POLICYBAZAAR_COVERAGE_GAP')
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    assert.equal(error.inventoryEvidence.pagesFetched, 1)
    assert.equal(error.nativeRoleCards.length, 4)
    assert.equal(error.retainedResponse.body, page.body)
    return true
  })
})
