import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('UDITCosmetech is registered as a verified first-party non-listing sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'uditcosmetech')

  assert.ok(provider, 'Expected UDITCosmetech provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'UDITCosmetech')
  assert.equal(provider.companyCareerPage, 'https://uditcosmetech.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-robots-plus-bundle-plus-common-routes-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-react-shell+verified-robots+verified-bundle+verified-common-non-listing-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'uditcosmetech.com')
  assert.match(provider.modulePath, /uditcosmetech[\\/]script\.js$/i)
})

test('UDITCosmetech matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'UDITCosmetech\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['UDITCosmetech', 'uditcosmetech', 'UDITCosmetech']],
  )
})

test('UDITCosmetech is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'uditcosmetech')

  assert.ok(scraper, 'Expected buildScrapers() to return the UDITCosmetech sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'uditcosmetech')
  assert.equal(scraper.provider.companyCareerPage, 'https://uditcosmetech.com/')
  assert.match(scraper.dryRunFile, /uditcosmetech[\\/]jobs\.json$/i)
})
