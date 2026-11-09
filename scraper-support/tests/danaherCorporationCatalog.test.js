import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Danaher Corporation as an official Phenom script provider', () => {
  const catalog = getScraperCatalog()
  const danaher = catalog.find((provider) => provider.source === 'danahercorporation')

  assert.ok(danaher)
  assert.equal(danaher.companyName, 'Danaher Corporation')
  assert.equal(danaher.adapter, 'script')
  assert.equal(danaher.atsPlatform, 'phenom')
  assert.match(danaher.companyCareerPage, /jobs\.danaher\.com\/global\/en\/search-results\?keywords=India/i)
  assert.equal(danaher.companyDomain, 'jobs.danaher.com')
  assert.match(danaher.modulePath, /danahercorporation[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Danaher Corporation scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const danaher = scrapers.find((scraper) => scraper.name === 'danahercorporation')

  assert.ok(danaher)
  assert.equal(typeof danaher.run, 'function')
  assert.match(danaher.dryRunFile, /danahercorporation[\\/]jobs\.json$/)
  assert.equal(danaher.provider.source, 'danahercorporation')
  assert.equal(danaher.provider.atsPlatform, 'phenom')
})
