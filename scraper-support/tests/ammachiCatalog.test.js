import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Ammachi Labs script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'ammachilabs')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wordpress-jobs-api')
  assert.match(provider.companyCareerPage, /ammachilabs\.org\/careers/i)
})

test('buildScrapers exposes a runnable Ammachi Labs scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'ammachilabs')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ammachilabs[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'ammachilabs')
})
