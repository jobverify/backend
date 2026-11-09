import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes BITSILICA as an official WordPress careers-feed script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'bitsilica')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://bitsilica.com/careers/')
  assert.equal(provider.companyDomain, 'bitsilica.com')
  assert.match(provider.modulePath, /bitsilica[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable BITSILICA scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'bitsilica')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /bitsilica[\\/]jobs\.json$/)
})
