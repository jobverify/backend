import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { PROVIDER_METADATA } from '../../scraper/valgenesis/script.js'

const nativeRole = (id, location, country) => ({
  id, text: 'Software Engineer', country, categories: { location },
  hostedUrl: 'https://jobs.lever.co/valgenesis/' + id,
  applyUrl: 'https://jobs.lever.co/valgenesis/' + id + '/apply',
  descriptionPlain: 'Build reliable validation services.',
})
const provider = getScraperCatalog().find(item => item.source === 'valgenesis')
const getScraper = (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('ValGenesis tests require controlled native transport'))
  return createCatalogScraper(provider)
}

test('ValGenesis catalog selects its verified native Lever source instead of the historical sentinel', () => {
  assert.ok(provider)
  assert.equal(provider.companyName, 'ValGenesis')
  assert.equal(provider.companyCareerPage, 'https://www.valgenesis.com/careers')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.boardToken, 'valgenesis')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(PROVIDER_METADATA.source, provider.source)
  assert.equal(PROVIDER_METADATA.atsPlatform, provider.atsPlatform)
  assert.equal(PROVIDER_METADATA.boardToken, provider.boardToken)
})

test('ValGenesis registered source maps native India roles and excludes foreign roles', async (t) => {
  const requests = []
  const jobs = await getScraper(t).run({ fetchJson: async url => {
    requests.push(url)
    return [nativeRole('india-role', 'Bengaluru, India', 'IN'), nativeRole('foreign-role', 'Boston, United States', 'US')]
  } })
  assert.deepEqual(requests, ['https://api.lever.co/v0/postings/valgenesis?mode=json'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'ValGenesis')
  assert.equal(jobs[0].source, 'valgenesis')
  assert.equal(jobs[0].applyUrl, 'https://jobs.lever.co/valgenesis/india-role/apply')
  assert.match(jobs[0].jobDescription, /reliable validation services/)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

test('ValGenesis empty inventory requires a complete native response', async (t) => {
  const jobs = await getScraper(t).run({ fetchJson: async () => [] })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('ValGenesis native errors cannot become an empty success', async (t) => {
  const scraper = getScraper(t)
  await assert.rejects(scraper.run({ fetchJson: async () => { throw new Error('HTTP 503') } }), /HTTP 503/)
  await assert.rejects(scraper.run({ fetchJson: async () => ({ error: 'unavailable' }) }), /inventory/i)
})
