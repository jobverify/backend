import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Canon India as an official-careers scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'canonindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://in.canon/en/consumer/web/career')
  assert.equal(provider.companyDomain, 'in.canon')
  assert.equal(provider.paginationStrategy, 'official-page-plus-oracle-zero-inventory-validation')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+verified-oracle-board+complete-public-inventory')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /canonindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Canon India scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'canonindia')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://in.canon/en/consumer/web/career')
})
