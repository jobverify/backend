import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CloudSEK as a Greenhouse api-portal provider', () => {
  const catalog = getScraperCatalog()
  const cloudsek = catalog.find((provider) => provider.source === 'cloudsek')

  assert.ok(cloudsek)
  assert.equal(cloudsek.adapter, 'apiPortal')
  assert.equal(cloudsek.atsPlatform, 'greenhouse')
  assert.match(cloudsek.companyCareerPage, /cloudsek\.com\/openings/i)
  assert.equal(cloudsek.companyDomain, 'cloudsek.com')
  assert.match(cloudsek.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/cloudsek\/jobs/i)
})

test('buildScrapers exposes a runnable CloudSEK provider without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cloudsek = scrapers.find((scraper) => scraper.name === 'cloudsek')

  assert.ok(cloudsek)
  assert.equal(typeof cloudsek.run, 'function')
  assert.equal(cloudsek.provider.adapter, 'apiPortal')
  assert.equal(cloudsek.provider.parser, 'api-portal')
  assert.match(cloudsek.provider.companyCareerPage, /cloudsek\.com\/openings/i)
})
