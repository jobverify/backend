import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Walmart is registered exactly once as a verified first-party empty sentinel for no public India-located hits', () => {
  const walmartProviders = getScraperCatalog().filter((item) => item.source === 'walmart')

  assert.equal(walmartProviders.length, 1, 'Expected a single Walmart provider in the scraper catalog')

  const [provider] = walmartProviders
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Walmart')
  assert.equal(provider.homepageUrl, 'https://careers.walmart.com/us/en')
  assert.equal(provider.companyCareerPage, 'https://careers.walmart.com/us/en/results')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-search-page-fail-closed')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-career-area-pages-plus-live-india-query-search-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-technology-and-corporate-pages+verified-live-search-api-india-query-no-located-hits-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.walmart.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.modulePath, /walmart[\\/]script\.js$/i)
})

test('Walmart matches company coverage directly from its provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nWalmart\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Walmart', 'walmart', 'Walmart']],
  )
})

test('Walmart is runnable exactly once through the scraper provider catalog', () => {
  const walmartScrapers = buildScrapers().filter((item) => item.name === 'walmart')

  assert.equal(walmartScrapers.length, 1, 'Expected buildScrapers() to expose Walmart exactly once')

  const [scraper] = walmartScrapers
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'walmart')
  assert.equal(scraper.provider.companyCareerPage, 'https://careers.walmart.com/us/en/results')
  assert.match(scraper.dryRunFile, /walmart[\\/]jobs\.json$/i)
})
