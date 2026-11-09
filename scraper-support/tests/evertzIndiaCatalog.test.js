import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Evertz India as an official public JSON-feed scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'evertzindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://evertz.com/contact/careers/')
  assert.equal(provider.companyDomain, 'evertz.com')
  assert.match(provider.modulePath, /evertzindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Evertz India scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'evertzindia')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.companyCareerPage, 'https://evertz.com/contact/careers/')
  assert.match(provider.dryRunFile, /evertzindia[\\/]jobs\.json$/)
})
