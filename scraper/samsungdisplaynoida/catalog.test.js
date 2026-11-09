import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'samsungdisplaynoida'
const COMPANY = 'Samsung Display Noida Pvt. Ltd.'
const COMPANY_PAGE_URL = 'https://www.samsungcareers.com/subsid/detail/C90'

test('Samsung Display Noida Pvt. Ltd. is registered against the exact Samsung Careers company page', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Samsung Display Noida provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.equal(provider.atsPlatform, 'samsung-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-plus-location-and-recruit-pages-plus-exact-company-page-and-company-filtered-listing-endpoint',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-location-page+verified-recruit-page+verified-exact-company-page+public-company-filtered-listing-html+public-detail-json+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'samsungcareers.com')
  assert.match(provider.modulePath, /samsungdisplaynoida[\\/]script\.js$/i)
})

test('Samsung Display Noida Pvt. Ltd. matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )
})

test('Samsung Display Noida Pvt. Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Samsung Display Noida scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.match(scraper.dryRunFile, /samsungdisplaynoida[\\/]jobs\.json$/i)
})
