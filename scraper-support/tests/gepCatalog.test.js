import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes GEP as an official-site no-listings script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'gep')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://www.gep.com/careers')
  assert.equal(provider.companyDomain, 'gep.com')
  assert.match(provider.modulePath, /gep[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GEP scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'gep')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-site')
  assert.match(provider.dryRunFile, /gep[\\/]jobs\.json$/)
})
