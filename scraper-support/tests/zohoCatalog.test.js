import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Zoho script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const zoho = catalog.find((provider) => provider.source === 'zoho')

  assert.ok(zoho)
  assert.equal(zoho.adapter, 'script')
  assert.equal(zoho.atsPlatform, 'zohorecruit')
  assert.match(zoho.companyCareerPage, /zoho\.com\/careers/i)
  assert.equal(zoho.companyDomain, 'zoho.com')
  assert.equal(zoho.parser, 'custom-script')
  assert.match(zoho.modulePath, /zoho[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Zoho script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const zoho = scrapers.find((scraper) => scraper.name === 'zoho')

  assert.ok(zoho)
  assert.equal(typeof zoho.run, 'function')
  assert.equal(zoho.provider.adapter, 'script')
  assert.equal(zoho.provider.parser, 'custom-script')
  assert.match(zoho.provider.companyCareerPage, /zoho\.com\/careers/i)
})
