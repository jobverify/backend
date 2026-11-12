import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {buildScrapers} from '../scraper-support/providers/index.js'
import {createPublishingGapAtsScraper} from '../scraper-support/utils/publishingGapAts.js'
import {extractionDetailHealth} from '../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence, isCompleteScraperAttempt} from '../scraper-support/utils/inventoryEvidence.js'

const payload = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/menlosecurity-current-native-inventory-20261112.json.gz', import.meta.url))))
const scrape = async (t, change) => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Unexpected network request'))
  const current = structuredClone(payload)
  change?.(current)
  return buildScrapers().find(row => row.name === 'menlosecurity').run({fetchJson: async url => {
    assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/menlosecurity')
    return current
  }})
}

test('registered Menlo enumerates country-qualified regional office labels from the current public inventory', async t => {
  const jobs = await scrape(t)
  assert.equal(jobs.length, 5)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription.length > 100))
  const inventoryEvidence = readInventoryEvidence(jobs)
  assert.equal(inventoryEvidence.status, 'complete-inventory')
  assert.equal(inventoryEvidence.reportedTotal, 23)
  assert.equal(inventoryEvidence.indiaFacetCount, 5)
  assert.equal(isCompleteScraperAttempt({success: true, inventoryEvidence,
    detailHealth: extractionDetailHealth(jobs), completedAt: new Date().toISOString()}), true)
})

for (const [label, change] of [
  ['broad region without a national suffix', record => {record.location = 'APAC'}],
  ['country-qualified region without the native postal country', record => {delete record.address.postalAddress.addressCountry}],
  ['worldwide label beside one postal country', record => {record.location = 'Worldwide'}],
  ['unknown country suffix', record => {record.location = 'APAC - Unspecified'}],
]) test('regional labels retain unknown inventory scope for ' + label, async t => {
  const jobs = await scrape(t, current => change(current.jobs.find(job => job.location === 'APAC - Japan')))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(extractionDetailHealth(jobs).complete, false)
})

test('regional country suffix cannot contradict the native postal country', async t => {
  await assert.rejects(scrape(t, current => {
    const record = current.jobs.find(job => job.location === 'APAC - Japan')
    record.location = 'APAC - India'
  }), /contradictory country\/location/)
})

test('a country-qualified regional label cannot certify an unknown additional native office', async t => {
  const jobs = await scrape(t, current => {
    const record = current.jobs.find(job => job.location === 'APAC - Japan')
    record.secondaryLocations.push({location: 'Remote', address: {postalAddress: {}}})
  })
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})

// This fixture helper exercises the same validator with a single observed role.
test('plain globally remote labels remain incomplete with a native country', async () => {
  const record = structuredClone(payload.jobs.find(job => job.location === 'APAC - Japan'))
  record.location = 'Global'
  const jobs = await createPublishingGapAtsScraper({source: 'regional-control', companyName: 'Menlo Security',
    atsPlatform: 'ashby', boardToken: 'menlosecurity'}).run({fetchJson: async () => ({...payload, jobs: [record]})})
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})
