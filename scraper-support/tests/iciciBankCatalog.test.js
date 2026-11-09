import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ICICI Bank Ltd as an official public careers API scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'icicibank')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers-blocked-no-public-jobs')
  assert.equal(provider.companyCareerPage, 'https://careers.icici.bank.in/CareerApplicant/Career/Home')
  assert.equal(provider.companyDomain, 'careers.icici.bank.in')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-listing-plus-api-blocked-shell')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+listing+search-api+detail-api-incident-shell-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /This page can't be displayed/i)
  assert.match(provider.verifiedSurfaceSummary, /CareerApplicantApi\/Career\/Search\/1/i)
  assert.match(provider.modulePath, /icicibank[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ICICI Bank scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'icicibank')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /icicibank[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'icicibank')
})
