import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the 24 7.ai smart-filter provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === '247ai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wordpress-smart-filter')
  assert.match(provider.companyCareerPage, /247\.ai\/jobs/i)
  assert.equal(provider.companyDomain, '247.ai')
})

test('buildScrapers exposes a runnable 24 7.ai scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === '247ai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /247ai[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, '247ai')
  assert.equal(scraper.provider.atsPlatform, 'wordpress-smart-filter')
})
