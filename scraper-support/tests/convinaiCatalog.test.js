import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Convin.ai as a LinkedIn guest-search script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'convinai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.companyCareerPage, 'https://convin.ai/')
  assert.equal(provider.companyDomain, 'convin.ai')
  assert.match(provider.modulePath, /convinai[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Convin.ai scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'convinai')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'linkedin-guest-search')
  assert.match(provider.dryRunFile, /convinai[\\/]jobs\.json$/)
})
