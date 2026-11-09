import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadGreenkoModule = async () => {
  try {
    return await import('../../scraper/greenko/script.js')
  } catch {
    assert.fail('Expected Greenko scraper module at ../../scraper/greenko/script.js')
  }
}

test('getScraperCatalog includes Greenko as a verified Darwinbox script provider', async () => {
  const greenko = await loadGreenkoModule()
  const provider = getScraperCatalog().find((item) => item.source === greenko.SOURCE)

  assert.ok(provider)
  assert.equal(provider.source, 'greenko')
  assert.equal(provider.companyName, 'Greenko')
  assert.equal(provider.officialBrandName, 'Greenko Hub')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.greenkogroup.com/')
  assert.equal(provider.companyDomain, 'greenkogroup.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-greenko-homepage-link+darwinbox-listing-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /29 India jobs/i)
  assert.match(provider.modulePath, /greenko[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /greenko[\\/]jobs\.json$/i)

  assert.equal(greenko.SOURCE, provider.source)
  assert.equal(greenko.COMPANY, provider.companyName)
  assert.equal(greenko.OFFICIAL_BRAND_NAME, provider.officialBrandName)
  assert.equal(greenko.HOMEPAGE_URL, provider.companyCareerPage)
  assert.equal(greenko.PUBLIC_JOBS_URL, 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(greenko.COMPANY_DOMAIN, provider.companyDomain)
  assert.equal(greenko.ATS_PLATFORM, provider.atsPlatform)
  assert.equal(greenko.COUNTRY_FILTER, provider.countryFilter)
  assert.equal(greenko.PAGINATION_STRATEGY, provider.paginationStrategy)
  assert.equal(greenko.PARSER, provider.parser)
  assert.equal(greenko.NORMALIZATION_PROFILE, provider.normalizationProfile)
  assert.equal(typeof greenko.createGreenkoScraper, 'function')
})

test('buildScrapers and company coverage resolve Greenko from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'greenko')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'greenko')
  assert.match(scraper.dryRunFile, /greenko[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Greenko,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Greenko', 'greenko', 'Greenko']],
  )
})
