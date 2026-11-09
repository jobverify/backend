import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the SolarEdge careers page script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'solaredge')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /corporate\.solaredge\.com\/en\/careers/i)
  assert.equal(provider.companyDomain, 'corporate.solaredge.com')
})

test('buildScrapers exposes a runnable SolarEdge scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'solaredge')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /solaredge[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'solaredge')
})
