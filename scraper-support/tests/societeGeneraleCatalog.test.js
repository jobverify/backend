import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Societe Generale public jobs script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'societegenerale')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-taleo')
  assert.match(provider.companyCareerPage, /careers\.societegenerale\.com\/en\/Technical\/all-job-offers/i)
  assert.equal(provider.companyDomain, 'careers.societegenerale.com')
})

test('buildScrapers exposes a runnable Societe Generale scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'societegenerale')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /societegenerale[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'societegenerale')
})
