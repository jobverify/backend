import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the CleverTap Kula-backed script provider once shared registry files are updated', () => {
  const catalog = getScraperCatalog()
  const cleverTap = catalog.find((provider) => provider.source === 'clevertap')

  assert.ok(cleverTap)
  assert.equal(cleverTap.adapter, 'script')
  assert.equal(cleverTap.atsPlatform, 'kula-public-api')
  assert.match(cleverTap.companyCareerPage, /clevertap\.com\/current-openings/i)
  assert.equal(cleverTap.companyDomain, 'clevertap.com')
  assert.match(cleverTap.modulePath, /clevertap[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CleverTap scraper once shared registry files are updated', () => {
  const scrapers = buildScrapers()
  const cleverTap = scrapers.find((scraper) => scraper.name === 'clevertap')

  assert.ok(cleverTap)
  assert.equal(typeof cleverTap.run, 'function')
  assert.match(cleverTap.dryRunFile, /clevertap[\\/]jobs\.json$/)
  assert.equal(cleverTap.provider.source, 'clevertap')
  assert.equal(cleverTap.provider.atsPlatform, 'kula-public-api')
})
