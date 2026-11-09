import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Sasken on the public HireWand careers page', () => {
  const catalog = getScraperCatalog()
  const sasken = catalog.find((provider) => provider.source === 'sasken')

  assert.ok(sasken)
  assert.equal(sasken.adapter, 'script')
  assert.equal(sasken.atsPlatform, 'hirewand')
  assert.match(sasken.companyCareerPage, /careers\.sasken\.com\/tb\/saskenjobs\/?$/i)
  assert.equal(sasken.companyDomain, 'careers.sasken.com')
  assert.match(sasken.modulePath, /sasken[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Sasken scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const sasken = scrapers.find((scraper) => scraper.name === 'sasken')

  assert.ok(sasken)
  assert.equal(typeof sasken.run, 'function')
  assert.match(sasken.dryRunFile, /sasken[\\/]jobs\.json$/)
  assert.equal(sasken.provider.source, 'sasken')
  assert.equal(sasken.provider.atsPlatform, 'hirewand')
})
