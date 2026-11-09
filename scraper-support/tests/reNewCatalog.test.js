import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadReNewModule = async () => {
  try {
    return await import('../../scraper/renew/script.js')
  } catch {
    assert.fail('Expected ReNew scraper module at ../../scraper/renew/script.js')
  }
}

test('getScraperCatalog includes ReNew as a verified employer-published partial LinkedIn provider', async () => {
  const reNew = await loadReNewModule()
  const provider = getScraperCatalog().find((item) => item.source === reNew.SOURCE)

  assert.ok(provider)
  assert.equal(provider.source, 'renew')
  assert.equal(provider.companyName, 'ReNew')
  assert.equal(provider.officialBrandName, 'ReNew Power')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/jobs/renew-jobs-worldwide?f_C=2563081')
  assert.equal(provider.companyDomain, 'renew.com')
  assert.equal(provider.atsPlatform, 'linkedin-employer-public-subset')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedLiveActiveJobCount, null)
  assert.equal(provider.verifiedLiveIndiaJobCount, null)
  assert.equal(provider.inventoryVerification.listingComplete, false)
  assert.equal(provider.paginationStrategy, 'counted-current-native-company-cards+stable-final-snapshot')
  assert.equal(
    provider.extractionStrategy,
    'first-party-careers+brand-alias+native-company2563081+JobPosting-full-JD+India+active-apply+partial-lifecycle',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /renew[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /renew[\\/]jobs\.json$/i)

  assert.equal(reNew.SOURCE, provider.source)
  assert.equal(reNew.COMPANY, provider.companyName)
  assert.equal(reNew.OFFICIAL_BRAND_NAME, provider.officialBrandName)
  assert.equal(reNew.CAREERS_URL, provider.companyCareerPage)
  assert.equal(reNew.COMPANY_DOMAIN, provider.companyDomain)
  assert.equal(reNew.ATS_PLATFORM, provider.atsPlatform)
  assert.equal(reNew.COUNTRY_FILTER, provider.countryFilter)
  assert.equal(reNew.PAGINATION_STRATEGY, provider.paginationStrategy)
  assert.equal(reNew.PARSER, provider.parser)
  assert.equal(reNew.NORMALIZATION_PROFILE, provider.normalizationProfile)
  assert.equal(typeof reNew.createReNewScraper, 'function')
})

test('buildScrapers and company coverage resolve ReNew from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'renew')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'renew')
  assert.match(scraper.dryRunFile, /renew[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'ReNew,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ReNew', 'renew', 'ReNew']],
  )
})
