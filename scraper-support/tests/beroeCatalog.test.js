import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Beroe India scraper with official careers metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'beroe')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /beroeinc\.com\/careers-vacancies/i)
})

test('buildScrapers exposes a runnable Beroe scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'beroe')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /beroe[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'beroe')
})
