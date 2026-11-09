import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Amazon on the official Amazon Jobs India search page', () => {
  const catalog = getScraperCatalog()
  const amazon = catalog.find((provider) => provider.source === 'amazon')

  assert.ok(amazon)
  assert.equal(amazon.adapter, 'script')
  assert.equal(amazon.atsPlatform, 'official-company-careers')
  assert.match(amazon.companyCareerPage, /amazon\.jobs\/en\/search/i)
  assert.equal(amazon.companyDomain, 'amazon.jobs')
  assert.match(amazon.modulePath, /amazon[\\/]script\.js$/i)
  assert.equal(amazon.scraperTimeoutMs, 1200000)
})

test('buildScrapers exposes a runnable Amazon scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const amazon = scrapers.find((scraper) => scraper.name === 'amazon')

  assert.ok(amazon)
  assert.equal(typeof amazon.run, 'function')
  assert.match(amazon.dryRunFile, /amazon[\\/]jobs\.json$/)
  assert.equal(amazon.provider.source, 'amazon')
  assert.equal(amazon.provider.atsPlatform, 'official-company-careers')
  assert.equal(amazon.provider.scraperTimeoutMs, 1200000)
})
