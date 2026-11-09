import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lambdatest/catalog.js')
  } catch {
    assert.fail('Expected LambdaTest catalog module at ../../scraper/lambdatest/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lambdatest/script.js')
  } catch {
    assert.fail('Expected LambdaTest scraper module at ../../scraper/lambdatest/script.js')
  }
}

test('LambdaTest local catalog captures the verified TestMu AI first-party careers API surface', async () => {
  const {
    LAMBDATEST_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const lambdaTest = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(LAMBDATEST_CATALOG)

  assert.equal(defaultCatalog, LAMBDATEST_CATALOG)
  assert.equal(LAMBDATEST_CATALOG.source, 'lambdatest')
  assert.equal(LAMBDATEST_CATALOG.companyName, 'LambdaTest')
  assert.equal(LAMBDATEST_CATALOG.officialBrandName, 'TestMu AI (Formerly LambdaTest)')
  assert.equal(LAMBDATEST_CATALOG.adapter, 'script')
  assert.equal(LAMBDATEST_CATALOG.modulePath, '../../scraper/lambdatest/script.js')
  assert.equal(LAMBDATEST_CATALOG.dryRunFile, 'lambdatest/jobs.json')
  assert.equal(LAMBDATEST_CATALOG.homepageUrl, 'https://www.lambdatest.com/')
  assert.equal(LAMBDATEST_CATALOG.legacyCareersPageUrl, 'https://www.lambdatest.com/careers')
  assert.equal(LAMBDATEST_CATALOG.companyCareerPage, 'https://www.testmuai.com/career/')
  assert.equal(
    LAMBDATEST_CATALOG.activeJobsApiUrl,
    'https://test-backend.lambdatest.com/api/careers-page/active-jobs',
  )
  assert.equal(
    LAMBDATEST_CATALOG.departmentsApiUrl,
    'https://test-backend.lambdatest.com/api/careers-page/org-departments',
  )
  assert.equal(
    LAMBDATEST_CATALOG.externalJobDetailBaseUrl,
    'https://lambdatest.kekahire.com/jobdetails/',
  )
  assert.equal(LAMBDATEST_CATALOG.atsPlatform, 'custom-json-api')
  assert.equal(LAMBDATEST_CATALOG.countryFilter, 'India')
  assert.equal(
    LAMBDATEST_CATALOG.paginationStrategy,
    'single-first-party-active-jobs-endpoint',
  )
  assert.equal(
    LAMBDATEST_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+first-party-active-jobs-api+department-verification+external-keka-jobdetail-links',
  )
  assert.equal(LAMBDATEST_CATALOG.parser, 'custom-script')
  assert.equal(LAMBDATEST_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LAMBDATEST_CATALOG.companyDomain, 'lambdatest.com')
  assert.equal(LAMBDATEST_CATALOG.verifiedOn, '2026-10-03')
  assert.equal(LAMBDATEST_CATALOG.verifiedPublicPostingCount, 4)
  assert.equal(LAMBDATEST_CATALOG.verifiedIndiaPostingCount, 4)
  assert.match(LAMBDATEST_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.testmuai\.com\/career\//i)
  assert.match(LAMBDATEST_CATALOG.verifiedSurfaceSummary, /active-jobs/i)
  assert.match(LAMBDATEST_CATALOG.verifiedSurfaceSummary, /org-departments/i)
  assert.match(LAMBDATEST_CATALOG.verifiedSurfaceSummary, /4 public postings/i)
  assert.match(LAMBDATEST_CATALOG.verifiedSurfaceSummary, /India locations/i)

  assert.equal(provider.source, 'lambdatest')
  assert.equal(provider.companyName, 'LambdaTest')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.testmuai.com/career/')
  assert.equal(provider.companyDomain, 'lambdatest.com')
  assert.match(provider.modulePath, /lambdatest[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /lambdatest[\\/]jobs\.json$/i)

  assert.equal(lambdaTest.PROVIDER_METADATA.source, provider.source)
  assert.equal(lambdaTest.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(lambdaTest.LEGACY_CAREERS_PAGE_URL, provider.legacyCareersPageUrl)
  assert.equal(lambdaTest.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
  assert.equal(lambdaTest.ACTIVE_JOBS_API_URL, provider.activeJobsApiUrl)
  assert.equal(lambdaTest.DEPARTMENTS_API_URL, provider.departmentsApiUrl)
})

test('LambdaTest exact-name backlog rows resolve directly from the local provider metadata', async () => {
  const { LAMBDATEST_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'LambdaTest\n',
    catalog: [hydrateProviderCatalogEntry(LAMBDATEST_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LambdaTest', 'lambdatest', 'LambdaTest']],
  )
})
