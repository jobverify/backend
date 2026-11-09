import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Fortinet as an Oracle Cloud script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'fortinet')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://www.fortinet.com/corporate/careers')
  assert.equal(provider.companyDomain, 'fortinet.com')
  assert.match(provider.modulePath, /fortinet[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Fortinet scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'fortinet')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'oracle-cloud')
  assert.match(provider.dryRunFile, /fortinet[\\/]jobs\.json$/)
})
