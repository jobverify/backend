import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/creditsuisse/catalog.js')
  } catch {
    assert.fail('Expected Credit Suisse catalog module at ../../scraper/creditsuisse/catalog.js')
  }
}

const loadCreditSuisseModule = async () => {
  try {
    return await import('../../scraper/creditsuisse/script.js')
  } catch {
    assert.fail('Expected Credit Suisse scraper module at ../../scraper/creditsuisse/script.js')
  }
}

test('getScraperCatalog includes Credit Suisse as a verified UBS-handoff sentinel', async () => {
  const { CREDIT_SUISSE_CATALOG } = await loadCatalog()
  const creditSuisse = await loadCreditSuisseModule()
  const provider = getScraperCatalog().find((item) => item.source === 'creditsuisse')

  assert.ok(provider)
  assert.equal(provider.source, 'creditsuisse')
  assert.equal(provider.companyName, 'Credit Suisse')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'legacy-brand-redirect-to-ubs-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'legacy-credit-suisse-careers-redirect-plus-ubs-search-jobs-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-credit-suisse-redirect-to-ubs-careers+ubs-search-jobs-handoff-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyCareerPage, 'https://www.credit-suisse.com/careers/en.html')
  assert.equal(provider.companyDomain, 'credit-suisse.com')
  assert.equal(provider.legacyHomepageUrl, 'https://www.credit-suisse.com/us/en.html')
  assert.equal(provider.officialHomepageRedirectUrl, 'https://www.ubs.com/us/en.html')
  assert.equal(provider.officialCareersRedirectUrl, 'https://www.ubs.com/global/en/careers.html')
  assert.equal(provider.officialSearchJobsUrl, 'https://www.ubs.com/global/en/careers/search-jobs.html')
  assert.equal(provider.officialJobsBoardHost, 'https://jobs.ubs.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /redirects to UBS Global Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy Credit Suisse-branded public jobs surface/i)
  assert.match(provider.modulePath, /creditsuisse[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /creditsuisse[\\/]jobs\.json$/i)

  assert.equal(CREDIT_SUISSE_CATALOG.source, provider.source)
  assert.equal(CREDIT_SUISSE_CATALOG.companyName, provider.companyName)
  assert.equal(CREDIT_SUISSE_CATALOG.companyCareerPage, provider.companyCareerPage)
  assert.equal(CREDIT_SUISSE_CATALOG.companyDomain, provider.companyDomain)
  assert.equal(creditSuisse.PROVIDER_METADATA.source, provider.source)
  assert.equal(creditSuisse.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    creditSuisse.PROVIDER_METADATA.officialCareersRedirectUrl,
    provider.officialCareersRedirectUrl,
  )
})

test('buildScrapers and company coverage resolve Credit Suisse from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'creditsuisse')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'creditsuisse')
  assert.match(scraper.dryRunFile, /creditsuisse[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Credit Suisse,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Credit Suisse', 'creditsuisse', 'Credit Suisse']],
  )
})
