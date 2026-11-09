import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Microsoft Eightfold apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const microsoft = catalog.find((provider) => provider.source === 'microsoft')

  assert.ok(microsoft)
  assert.equal(microsoft.adapter, 'apiPortal')
  assert.equal(microsoft.atsPlatform, 'eightfold')
  assert.match(microsoft.companyCareerPage, /careers\.microsoft\.com/i)
  assert.equal(microsoft.companyDomain, 'careers.microsoft.com')
  assert.match(microsoft.config.discovery.listingApiUrl, /apply\.careers\.microsoft\.com\/api\/pcsx\/search/i)
  assert.deepEqual(microsoft.config.mapping.location, ['standardizedLocations.1', 'locations.0'])
  assert.match(microsoft.config.detail.urlTemplate, /queried_location=India/i)
})

test('buildScrapers exposes a runnable Microsoft apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const microsoft = scrapers.find((scraper) => scraper.name === 'microsoft')

  assert.ok(microsoft)
  assert.equal(typeof microsoft.run, 'function')
  assert.match(microsoft.dryRunFile, /microsoft[\\/]jobs\.json$/)
  assert.equal(microsoft.provider.source, 'microsoft')
  assert.equal(microsoft.provider.atsPlatform, 'eightfold')
})
