import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the SG Analytics official careers script provider with verified metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'sganalytics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /sganalytics\.com\/careers\/jobs/i)
  assert.equal(provider.companyDomain, 'sganalytics.com')
})

test('buildScrapers exposes a runnable SG Analytics scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'sganalytics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /sganalytics[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'sganalytics')
})
