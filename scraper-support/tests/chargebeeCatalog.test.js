import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Chargebee LinkedIn-routed script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const chargebee = catalog.find((provider) => provider.source === 'chargebee')

  assert.ok(chargebee)
  assert.equal(chargebee.adapter, 'script')
  assert.equal(chargebee.atsPlatform, 'official-company-careers')
  assert.match(chargebee.companyCareerPage, /chargebee\.com\/careers\/join-us/i)
  assert.equal(chargebee.companyDomain, 'chargebee.com')
  assert.equal(chargebee.parser, 'custom-script')
  assert.match(chargebee.modulePath, /chargebee[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Chargebee script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const chargebee = scrapers.find((scraper) => scraper.name === 'chargebee')

  assert.ok(chargebee)
  assert.equal(typeof chargebee.run, 'function')
  assert.equal(chargebee.provider.adapter, 'script')
  assert.equal(chargebee.provider.parser, 'custom-script')
  assert.match(chargebee.provider.companyCareerPage, /chargebee\.com\/careers\/join-us/i)
})
