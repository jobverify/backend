import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes byteXL as the Thursday, August 13, 2026 homepage-plus-missing-careers-route provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'bytexl')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://bytexl.com/careers')
  assert.equal(provider.companyDomain, 'bytexl.com')
  assert.equal(provider.paginationStrategy, 'homepage-plus-current-careers-route-404-validation')
  assert.equal(provider.extractionStrategy, 'verified-homepage+verified-missing-careers-route-return-empty')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bytexl\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /404 Not Found/i)
  assert.match(provider.modulePath, /bytexl[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable byteXL scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'bytexl')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /bytexl[\\/]jobs\.json$/)
})
