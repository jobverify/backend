import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const everestModulePath = path.resolve(currentDir, '../../scraper/everest.workday/script.js')

const loadEverestCatalog = async () => {
  try {
    return await import('../../scraper/everest.workday/catalog.js')
  } catch {
    assert.fail('Expected Everest catalog module at ../../scraper/everest.workday/catalog.js')
  }
}

const loadEverestModule = async () => {
  try {
    return await import('../../scraper/everest.workday/script.js')
  } catch {
    assert.fail('Expected Everest scraper module at ../../scraper/everest.workday/script.js')
  }
}

test('Everest local catalog captures the verified first-party careers handoff and official Workday source', async () => {
  const { EVEREST_CATALOG } = await loadEverestCatalog()
  const everest = await loadEverestModule()

  assert.equal(EVEREST_CATALOG.source, 'everest')
  assert.equal(EVEREST_CATALOG.companyName, 'Everest')
  assert.equal(EVEREST_CATALOG.officialBrandName, 'Everest')
  assert.equal(EVEREST_CATALOG.adapter, 'script')
  assert.equal(EVEREST_CATALOG.homepageUrl, 'https://www.everestglobal.com/')
  assert.equal(EVEREST_CATALOG.companyCareerPage, 'https://www.everestglobal.com/careers/')
  assert.equal(
    EVEREST_CATALOG.careerOverviewUrl,
    'https://www.everestglobal.com/us-en/career-opportunities/overview',
  )
  assert.equal(
    EVEREST_CATALOG.officialJobsBoardUrl,
    'https://wd5.myworkdaysite.com/recruiting/everestre/careers',
  )
  assert.equal(
    EVEREST_CATALOG.jobsApiUrl,
    'https://wd5.myworkdaysite.com/wday/cxs/everestre/careers/jobs',
  )
  assert.equal(
    EVEREST_CATALOG.sampleJobDetailUrl,
    'https://wd5.myworkdaysite.com/recruiting/everestre/careers/job/Singapore/Associate-Underwriter--ERDP---Singapore_R6960',
  )
  assert.equal(EVEREST_CATALOG.companyDomain, 'everestglobal.com')
  assert.equal(EVEREST_CATALOG.atsPlatform, 'workday')
  assert.equal(EVEREST_CATALOG.countryFilter, 'India')
  assert.equal(
    EVEREST_CATALOG.paginationStrategy,
    'verified-first-party-careers-handoff-plus-workday-jobs-api-pagination',
  )
  assert.equal(
    EVEREST_CATALOG.extractionStrategy,
    'verify-homepage+verify-careers-handoff+verify-workday-board+jobs-api-list-parse+grouped-detail-location-check+india-location-filter',
  )
  assert.equal(EVEREST_CATALOG.parser, 'custom-script')
  assert.equal(EVEREST_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EVEREST_CATALOG.verifiedOn, '2026-08-01')
  assert.equal(EVEREST_CATALOG.dryRunFile, 'everest.workday/jobs.json')
  assert.match(EVEREST_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.everestglobal\.com\//i)
  assert.match(EVEREST_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.everestglobal\.com\/careers\//i)
  assert.match(EVEREST_CATALOG.verifiedSurfaceSummary, /https:\/\/wd5\.myworkdaysite\.com\/recruiting\/everestre\/careers/i)
  assert.match(EVEREST_CATALOG.verifiedSurfaceSummary, /https:\/\/wd5\.myworkdaysite\.com\/wday\/cxs\/everestre\/careers\/jobs/i)
  assert.match(EVEREST_CATALOG.verifiedSurfaceSummary, /View Job Openings/i)
  assert.match(EVEREST_CATALOG.verifiedSurfaceSummary, /trusted source for live openings/i)
  assert.equal(EVEREST_CATALOG.modulePath, everestModulePath)

  assert.equal(everest.PROVIDER_METADATA.source, EVEREST_CATALOG.source)
  assert.equal(everest.PROVIDER_METADATA.companyName, EVEREST_CATALOG.companyName)
  assert.equal(everest.PROVIDER_METADATA.officialJobsBoardUrl, EVEREST_CATALOG.officialJobsBoardUrl)
  assert.equal(everest.PROVIDER_METADATA.jobsApiUrl, EVEREST_CATALOG.jobsApiUrl)
})

test('Everest backlog row hydrates locally without needing an alias entry', async () => {
  const { EVEREST_CATALOG } = await loadEverestCatalog()
  const provider = hydrateProviderCatalogEntry(EVEREST_CATALOG)

  assert.equal(provider.companyName, 'Everest')
  assert.equal(provider.companyDomain, 'everestglobal.com')
  assert.match(provider.modulePath, /everest\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /everest.workday[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Everest'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Everest\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Everest', 'everest', 'Everest']],
  )
})
