import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog exposes CoinDCX current employer job subset with unknown complete inventory', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'coindcx')

  assert.ok(provider)
  assert.equal(provider.companyName, 'CoinDCX')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-employer')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/company/coindcx/jobs/')
  assert.equal(provider.companyDomain, 'coindcx.com')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.match(provider.verifiedSurfaceSummary, /complete employer\/global\/India inventory is unknown/i)
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.listingComplete, false)
  assert.equal(provider.verifiedInventoryStatus, 'coverage-gap')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedObservedIndiaSubsetCount, 9)
  assert.match(provider.modulePath, /coindcx[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CoinDCX scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'coindcx')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.linkedin.com/company/coindcx/jobs/')
})
