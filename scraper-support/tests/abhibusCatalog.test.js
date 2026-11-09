import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAbhiBusCatalogModule = async () => {
  try {
    return await import('../../scraper/abhibus/catalog.js')
  } catch {
    assert.fail('Expected AbhiBus catalog module at ../../scraper/abhibus/catalog.js')
  }
}

test('AbhiBus catalog captures the verified first-party SmartRecruiters API-backed careers surface metadata', async () => {
  const abhibusCatalog = await loadAbhiBusCatalogModule()

  assert.deepEqual(abhibusCatalog.ABHIBUS_CATALOG, {
    source: 'abhibus',
    companyName: 'AbhiBus',
    companyCareerPage: 'https://www.abhibus.com/careers/',
    companyDomain: 'abhibus.com',
    adapter: 'script',
    atsPlatform: 'smartrecruiters',
    countryFilter: 'India',
    paginationStrategy: 'official-page-plus-smartrecruiters-api',
    extractionStrategy: 'verified-first-party-careers-page+embedded-smartrecruiters-api+detail-api+india-filter',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    modulePath: 'scraper/abhibus/script.js',
    verifiedOn: '2026-07-19',
    verifiedSurfaceSummary:
      'Verified on July 19, 2026 that https://www.abhibus.com/careers/ is the live first-party AbhiBus careers page and now embeds the official SmartRecruiters postings API https://api.smartrecruiters.com/v1/companies/AbhiBus/postings. The API returned public India postings with SmartRecruiters detail/apply URLs under jobs.smartrecruiters.com/AbhiBus.',
    smartRecruitersCompanyIdentifier: 'AbhiBus',
    smartRecruitersListingApiUrl: 'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings',
    smartRecruitersDetailApiUrlTemplate:
      'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings/{{jobId}}',
    homepageUrl: 'https://www.abhibus.com/',
  })
})

test('buildScrapers and company coverage resolve Abhibus from the shared catalog and alias map', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'abhibus')
  const scraper = buildScrapers().find((item) => item.name === 'abhibus')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AbhiBus')
  assert.equal(provider.companyCareerPage, 'https://www.abhibus.com/careers/')
  assert.equal(provider.paginationStrategy, 'official-page-plus-smartrecruiters-api')
  assert.equal(provider.smartRecruitersListingApiUrl, 'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings')
  assert.match(scraper.dryRunFile, /abhibus[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Abhibus\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Abhibus', 'abhibus', 'AbhiBus']],
  )
})
