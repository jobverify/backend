import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes GE Aerospace as a Phenom script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'geaerospace')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.companyCareerPage, 'https://careers.geaerospace.com/global/en/search-results')
  assert.equal(provider.companyDomain, 'careers.geaerospace.com')
  assert.match(provider.modulePath, /geaerospace[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GE Aerospace scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'geaerospace')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.match(provider.dryRunFile, /geaerospace[\\/]jobs\.json$/)
  assert.equal(provider.provider.source, 'geaerospace')
  assert.equal(provider.provider.atsPlatform, 'phenom')
})
