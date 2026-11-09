import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jupiter/catalog.js')
  } catch {
    assert.fail('Expected Jupiter catalog module at ../../scraper/jupiter/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/jupiter/script.js')
  } catch {
    assert.fail('Expected Jupiter scraper module at ../../scraper/jupiter/script.js')
  }
}

test('Jupiter local catalog captures the verified first-party Keka careers surface', async () => {
  const { JUPITER_CATALOG } = await loadCatalogModule()
  const jupiter = await loadScraperModule()

  assert.equal(JUPITER_CATALOG.source, 'jupiter')
  assert.equal(JUPITER_CATALOG.companyName, 'Jupiter')
  assert.equal(JUPITER_CATALOG.officialBrandName, 'Jupiter Money')
  assert.equal(JUPITER_CATALOG.adapter, 'script')
  assert.match(JUPITER_CATALOG.modulePath, /jupiter[\\/]script\.js$/i)
  assert.equal(JUPITER_CATALOG.companyCareerPage, 'https://jupiter.money/careers/')
  assert.equal(JUPITER_CATALOG.officialCareersPageUrl, 'https://jupiter.money/careers/')
  assert.equal(JUPITER_CATALOG.officialJobsBoardUrl, 'https://jupiter.keka.com/careers')
  assert.equal(
    JUPITER_CATALOG.careerPortalInfoUrl,
    'https://jupiter.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(
    JUPITER_CATALOG.activeJobsUrl,
    'https://jupiter.keka.com/careers/api/embedjobs/default/active/b5279857-cf81-4dde-a215-fc48957ee2b5',
  )
  assert.equal(
    JUPITER_CATALOG.departmentsUrl,
    'https://jupiter.keka.com/careers/api/embedjobs/departments/b5279857-cf81-4dde-a215-fc48957ee2b5',
  )
  assert.equal(
    JUPITER_CATALOG.groupLinkStatusUrl,
    'https://jupiter.keka.com/careers/api/embedjobs/grouplinkstatus/b5279857-cf81-4dde-a215-fc48957ee2b5',
  )
  assert.equal(JUPITER_CATALOG.expectedKekaDomain, 'https://jupiter.keka.com/careers/')
  assert.equal(JUPITER_CATALOG.expectedIdentifier, 'b5279857-cf81-4dde-a215-fc48957ee2b5')
  assert.equal(JUPITER_CATALOG.companyDomain, 'jupiter.money')
  assert.equal(JUPITER_CATALOG.atsPlatform, 'keka-embed-api')
  assert.equal(JUPITER_CATALOG.countryFilter, 'India')
  assert.equal(JUPITER_CATALOG.verifiedActiveJobCount, 13)
  assert.equal(JUPITER_CATALOG.verifiedActiveSampleTitle, 'Devops Engineer - SDE 2')
  assert.equal(
    JUPITER_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-keka-active-jobs-api',
  )
  assert.equal(
    JUPITER_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-keka-careers-link+careerportalinfo+active-keka-embed-api',
  )
  assert.equal(JUPITER_CATALOG.parser, 'custom-script')
  assert.equal(JUPITER_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(JUPITER_CATALOG.verifiedOn, '2026-08-02')
  assert.equal(JUPITER_CATALOG.dryRunFile, 'jupiter/jobs.json')
  assert.match(JUPITER_CATALOG.verifiedSurfaceSummary, /https:\/\/jupiter\.money\/careers\//i)
  assert.match(JUPITER_CATALOG.verifiedSurfaceSummary, /https:\/\/jupiter\.keka\.com\/careers/i)
  assert.match(
    JUPITER_CATALOG.verifiedSurfaceSummary,
    /https:\/\/jupiter\.keka\.com\/careers\/api\/embedjobs\/default\/active\/b5279857-cf81-4dde-a215-fc48957ee2b5/i,
  )
  assert.match(JUPITER_CATALOG.verifiedSurfaceSummary, /13 active public openings/i)
  assert.match(JUPITER_CATALOG.verifiedSurfaceSummary, /Devops Engineer - SDE 2/i)

  assert.equal(jupiter.PROVIDER_METADATA.source, JUPITER_CATALOG.source)
  assert.equal(jupiter.PROVIDER_METADATA.activeJobsUrl, JUPITER_CATALOG.activeJobsUrl)
})

test('Jupiter exact backlog row matches directly from the local catalog without alias churn', async () => {
  const { JUPITER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Jupiter\n',
    catalog: [JUPITER_CATALOG],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jupiter', 'jupiter', 'Jupiter']],
  )
})
