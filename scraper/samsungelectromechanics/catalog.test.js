import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'samsungelectromechanics'
const COMPANY = 'Samsung Electro-Mechanics'
const COMPANY_PAGE_URL = 'https://www.samsungcareers.com/subsid/detail/C40'

test('Samsung Electro-Mechanics is registered against the exact first-party Samsung Careers company page without unsupported alias drift', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Samsung Electro-Mechanics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.equal(provider.atsPlatform, 'samsung-careers')
  assert.equal(provider.countryFilter, 'South Korea')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-plus-exact-company-page-plus-company-filtered-listing-endpoint',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-exact-company-page+public-company-filtered-listing-html+public-detail-json',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'samsungcareers.com')
  assert.match(provider.modulePath, /samsungelectromechanics[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Samsung Electro Mechanics'), false)
})

test('Samsung Electro-Mechanics matches company coverage directly from provider metadata', () => {
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

test('Samsung Electro-Mechanics is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Samsung Electro-Mechanics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, COMPANY_PAGE_URL)
  assert.match(scraper.dryRunFile, /samsungelectromechanics[\\/]jobs\.json$/i)
})
