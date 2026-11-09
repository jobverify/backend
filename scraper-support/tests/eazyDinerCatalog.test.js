import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes EazyDiner with the Thursday, August 13, 2026 sitemap-placeholder sentinel metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'eazydiner')

  assert.ok(provider)
  assert.equal(provider.companyName, 'EazyDiner')
  assert.equal(provider.companyCareerPage, 'https://www.eazydiner.com/career')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.match(provider.verifiedSurfaceSummary, /others\.xml/i)
})

test('buildScrapers exposes a runnable EazyDiner sentinel scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'eazydiner')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.eazydiner.com/career')
})
