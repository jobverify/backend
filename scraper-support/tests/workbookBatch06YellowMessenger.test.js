import test from 'node:test'
import assert from 'node:assert/strict'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { makeZohoFixture, zohoFixtureOptions } from './fixtures/zohoNativeOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Yellow selected catalog requires current native inventory evidence', async () => {
  const provider = getScraperCatalog().find(p => p.source === 'yellowmessenger')
  assert.equal(provider.companyName, 'Yellow Messenger')
  assert.equal(provider.companyCareerPage, 'https://yellow.ai/career/')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  const data = makeZohoFixture('yellowmessenger'); data.rows = []
  const jobs = await createCatalogScraper(provider).run(zohoFixtureOptions(data))
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('Yellow rejects a changed native organization page', async () => {
  const data = makeZohoFixture('yellowmessenger'); data.meta.page_id = 'other'
  const provider = getScraperCatalog().find(p => p.source === data.spec.source)
  await assert.rejects(createCatalogScraper(provider).run(zohoFixtureOptions(data)))
})

test('Yellow cannot reuse an earlier corporate binding when the current loader disappears', async () => {
  const provider = getScraperCatalog().find(p => p.source === 'yellowmessenger')
  const scraper = createCatalogScraper(provider)
  await scraper.run(zohoFixtureOptions(makeZohoFixture('yellowmessenger')))
  const data = makeZohoFixture('yellowmessenger'); data.homepage = '<h1>Careers</h1>'
  await assert.rejects(scraper.run(zohoFixtureOptions(data)), /current|active exact/)
})
