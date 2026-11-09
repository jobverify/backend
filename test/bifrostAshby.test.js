import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const provider = { source: 'bifrostai', companyName: 'Bifrost AI', atsPlatform: 'ashby', boardToken: 'bifrost' }
const job = { id: 'native-id', title: 'Software Engineer', location: 'Bengaluru, India',
  address: { postalAddress: { addressLocality: 'Bengaluru', addressRegion: 'Karnataka', addressCountry: 'IND' } },
  jobUrl: 'https://jobs.ashbyhq.com/bifrost/native-id', applyUrl: 'https://jobs.ashbyhq.com/bifrost/native-id/application',
  isListed: true, descriptionHtml: '<p>Build and operate synthetic data simulation tools. Develop reliable rendering pipelines and validate production datasets.</p>' }
const run = payload => createPublishingGapAtsScraper(provider).run({ fetchJson: async () => payload })

test('Bifrost catalog uses the exact current official Ashby board without adding a source', () => {
  const catalog = getScraperCatalog(), rows = catalog.filter(row => row.source === 'bifrostai')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].adapter, 'publicAts')
  assert.equal(rows[0].boardToken, 'bifrost')
  assert.equal(rows[0].bindingEvidence.verified, true)
  assert.equal(rows[0].verifiedIndiaJobCount, null)
})

test('documented current empty Ashby response carries checked inventory evidence', async () => {
  const payload = JSON.parse(fs.readFileSync(new URL('fixtures/bifrostai/empty-native.json', import.meta.url)))
  const source = getScraperCatalog().find(row => row.source === 'bifrostai')
  const jobs = await createCatalogScraper(source).run({ fetchJson: async url => {
    assert.equal(url, 'https://api.ashbyhq.com/posting-api/job-board/bifrost')
    return payload
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('future valid India roles retain native complete descriptions and exact application identity', async () => {
  const jobs = await run({ apiVersion: '1', jobs: [job] })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobDescription, job.descriptionHtml)
  assert.equal(jobs[0].applyUrl, job.applyUrl)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Ashby error envelopes, unsupported schemas and ambiguous active status cannot establish zero', async () => {
  for (const payload of [
    { apiVersion: '1', jobs: [], error: 'temporarily unavailable' },
    { apiVersion: '1', jobs: [], errors: [{ message: 'unavailable' }] },
    { apiVersion: '1', jobs: [], success: false },
    { apiVersion: '1', jobs: [], status: 503 },
    { apiVersion: '2', jobs: [] },
    { apiVersion: '1', jobs: [{ ...job, isListed: 'true' }] },
    { apiVersion: '1', jobs: [{ ...job, isListed: undefined }] },
  ]) await assert.rejects(run(payload), /inventory|schema|status/i)
  const unknown = await run({ jobs: [] })
  assert.equal(readInventoryEvidence(unknown).listingComplete, false)
  assert.equal(readInventoryEvidence(unknown).status, 'discovery-only')
})

test('Ashby duplicate identity, foreign tenant and non-string content reject before mapping', async () => {
  for (const jobs of [
    [job, { ...job }],
    [{ ...job, applyUrl: 'https://jobs.ashbyhq.com/unrelated/native-id/application' }],
    [{ ...job, jobUrl: 'https://jobs.ashbyhq.com/bifrost/other-id' }],
    [{ ...job, jobUrl: [job.jobUrl], applyUrl: [job.applyUrl] }],
    [job, { ...job, id: ' native-id ', jobUrl: 'https://jobs.ashbyhq.com/bifrost/%20native-id%20', applyUrl: 'https://jobs.ashbyhq.com/bifrost/%20native-id%20/application' }],
    [{ ...job, descriptionHtml: { text: 'not native text' } }],
    [{ ...job, location: { name: 'India' } }],
    [{ ...job, address: { postalAddress: { addressCountry: 'USA' } } }],
    [{ ...job, location: 'Bengaluru, India, United States' }],
    ...[false, 0, ''].map(postalAddress => [{ ...job, address: { postalAddress } }]),
  ]) await assert.rejects(run({ apiVersion: '1', jobs }), /identity|inventory|content|location/i)
})

test('native India country includes India remote roles and cities outside the legacy location regex', async () => {
  for (const country of ['India', 'IN', 'IND']) for (const location of ['Jaipur', 'Kochi', 'Gangtok', 'Remote']) {
    const jobs = await run({ apiVersion: '1', jobs: [{ ...job, location,
      address: { postalAddress: { addressCountry: country, addressLocality: location } } }] })
    assert.equal(jobs.length, 1, `${country}/${location} must retain explicit native India scope`)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
    assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  }
})

test('unlocated Ashby records retain unknown scope; foreign inventory is distinct from globally empty', async () => {
  const unlocated = await run({ apiVersion: '1', jobs: [{ ...job, location: 'Remote', address: null }] })
  assert.equal(unlocated.length, 0)
  assert.equal(readInventoryEvidence(unlocated).listingComplete, false)
  const foreign = await run({ apiVersion: '1', jobs: [{ ...job, location: 'San Francisco, United States',
    address: { postalAddress: { addressLocality: 'San Francisco', addressCountry: 'USA' } } }] })
  assert.equal(foreign.length, 0)
  assert.equal(readInventoryEvidence(foreign).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(foreign).reportedTotal, 1)
})
