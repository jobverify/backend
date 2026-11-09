import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Bhanzu scraper with public Keka metadata', () => {
  const catalog = getScraperCatalog()
  const bhanzu = catalog.find((provider) => provider.source === 'bhanzu')

  assert.ok(bhanzu)
  assert.equal(bhanzu.adapter, 'script')
  assert.equal(bhanzu.atsPlatform, 'keka-embed-api')
  assert.match(bhanzu.companyCareerPage, /bhanzu\.com\/careers/i)
  assert.equal(bhanzu.companyDomain, 'bhanzu.com')
})

test('buildScrapers exposes a runnable Bhanzu scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bhanzu = scrapers.find((scraper) => scraper.name === 'bhanzu')

  assert.ok(bhanzu)
  assert.equal(typeof bhanzu.run, 'function')
  assert.match(bhanzu.dryRunFile, /bhanzu[\\/]jobs\.json$/)
  assert.equal(bhanzu.provider.source, 'bhanzu')
  assert.equal(bhanzu.provider.adapter, 'script')
})
