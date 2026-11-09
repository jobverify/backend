import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/kimobility/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kimobility/catalog.js')
  } catch {
    assert.fail('Expected Ki Mobility catalog module at ../../scraper/kimobility/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kimobility/script.js')
  } catch {
    assert.fail('Expected Ki Mobility scraper module at ../../scraper/kimobility/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Ki Mobility local catalog captures the verified first-party careers handoff and public ADP board contract', async () => {
  const { KI_MOBILITY_CATALOG, VERIFIED_SURFACE_SUMMARY } = await loadCatalogModule()
  const kiMobility = await loadScriptModule()
  const provider = buildCatalogReadyProvider(KI_MOBILITY_CATALOG)

  assert.equal(provider.source, 'kimobility')
  assert.equal(provider.companyName, 'Ki Mobility')
  assert.equal(provider.officialBrandName, 'Ki Mobility')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.kimobility.com/')
  assert.equal(provider.companyCareerPage, 'https://www.kimobility.com/careers')
  assert.equal(
    provider.officialJobsBoardUrl,
    'https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&locale=en_US&$top=100',
  )
  assert.equal(
    provider.searchFiltersApiUrl,
    'https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/getSearchFilters?cid=d4c8f64f-44e0-49a4-95d7-5c8d1767e36d&ccId=19000101_000001&lang=en_US&locale=en_US',
  )
  assert.equal(provider.atsPlatform, 'adp-workforcenow')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-adp-job-requisitions-call')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-public-adp-board+job-requisitions-api+detail-api+india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'kimobility.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.kimobility\.com\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/workforcenow\.adp\.com\/mascsr\/default\/mdf\/recruitment\/recruitment\.html/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /United States \(Countrywide\)/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no India roles/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /kimobility[\\/]jobs\.json$/i)

  assert.equal(kiMobility.PROVIDER_METADATA.source, provider.source)
  assert.equal(kiMobility.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(kiMobility.CAREERS_PAGE_URL, provider.companyCareerPage)
  assert.equal(kiMobility.ADP_BOARD_URL, provider.officialJobsBoardUrl)
})

test('Ki Mobility exact backlog row matches from the local provider contract without aliases', async () => {
  const { KI_MOBILITY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ki Mobility\n',
    catalog: [buildCatalogReadyProvider(KI_MOBILITY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ki Mobility', 'kimobility', 'Ki Mobility']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Ki Mobility'), false)
})
