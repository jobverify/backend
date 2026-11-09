import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Honeywell as an Oracle Cloud script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'honeywell')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyCareerPage, 'https://careers.honeywell.com/en/sites/Honeywell')
  assert.equal(provider.companyDomain, 'careers.honeywell.com')
  assert.match(provider.modulePath, /honeywell[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Honeywell scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'honeywell')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'oracle-cloud')
  assert.match(provider.dryRunFile, /honeywell[\\/]jobs\.json$/)
})
