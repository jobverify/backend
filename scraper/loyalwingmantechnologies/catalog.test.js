import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'loyalwingmantechnologies'
const COMPANY = 'Loyal Wingman Technologies'
const INDIA_JOBS_URL = 'https://www.linkedin.com/jobs/search/?f_C=96646029&geoId=102713980'
const LINKEDIN_COMPANY_URL = 'https://www.linkedin.com/company/loyal-wingman-technologies-private-limited/'

test('Loyal Wingman Technologies is registered against the verified LinkedIn public jobs surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Loyal Wingman Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, INDIA_JOBS_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    LINKEDIN_COMPANY_URL,
    'https://loyalwingtech.com/',
  ])
  assert.equal(provider.atsPlatform, 'linkedin-company-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-linkedin-company-india-jobs-search-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-linkedin-company-page+verified-linkedin-company-india-jobs-search+india-card-extraction',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'loyalwingtech.com')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /loyalwingtech\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /linkedin\.com\/company\/loyal-wingman-technologies-private-limited/i)
  assert.match(provider.modulePath, /loyalwingmantechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Loyal Wingman Technologies resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY}\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Loyal Wingman Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, INDIA_JOBS_URL)
  assert.match(scraper.dryRunFile, /loyalwingmantechnologies[\\/]jobs\.json$/i)
})
