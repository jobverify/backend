import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the i-exceed first-party careers scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'iexceed')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'i-exceed technology solutions')
  assert.equal(provider.companyCareerPage, 'https://www.i-exceed.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'i-exceed.com')
})

test('buildScrapers exposes a runnable i-exceed scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'iexceed')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /iexceed[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'iexceed')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
})
