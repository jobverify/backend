import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Bank of America public careers script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'bankofamerica')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'bankofamerica-jobssearchservlet')
  assert.match(provider.companyCareerPage, /careers\.bankofamerica\.com\/en-us\/job-search/i)
})

test('buildScrapers exposes a runnable Bank of America scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'bankofamerica')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bankofamerica[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'bankofamerica')
})
