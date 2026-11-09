import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ciklum/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ciklum/catalog.js')
  } catch {
    assert.fail('Expected Ciklum catalog module at ../../scraper/ciklum/catalog.js')
  }
}

test('Ciklum local catalog captures the verified first-party India careers handoff and Oracle jobs contract', async () => {
  const { CIKLUM_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CIKLUM_CATALOG)

  assert.equal(defaultCatalog, CIKLUM_CATALOG)
  assert.equal(provider.source, 'ciklum')
  assert.equal(provider.companyName, 'Ciklum')
  assert.equal(provider.officialBrandName, 'Ciklum')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialCareersLandingUrl, 'https://jobs.ciklum.com/offices/india/')
  assert.equal(
    provider.companyCareerPage,
    'https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243',
  )
  assert.equal(
    provider.oracleCandidateExperienceUrl,
    'https://explore-jobs.ciklum.com/en/sites/ciklum-career/jobs?lastSelectedFacet=LOCATIONS&selectedLocationsFacet=300000000468243',
  )
  assert.equal(provider.workspaceDomain, 'ialmme.fa.ocs.oraclecloud.com')
  assert.equal(
    provider.listingApiBaseUrl,
    'https://ialmme.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    provider.detailApiBaseUrl,
    'https://ialmme.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    provider.publicJobsBaseUrl,
    'https://explore-jobs.ciklum.com/en/sites/ciklum-career/job/',
  )
  assert.equal(provider.siteNumber, 'CX_1001')
  assert.equal(provider.selectedLocationsFacet, '300000000468243')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'oracle-location-facet-offset-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-india-page+verified-first-party-oracle-shell+oracle-location-facet-listing-api+oracle-detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.ciklum.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedJobCount, 24)
  assert.match(provider.sampleJobUrl, /sites\/ciklum-career\/job\/3469$/i)
  assert.match(provider.dryRunFile, /ciklum[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ciklum\.com\/offices\/india\//i)
  assert.match(provider.verifiedSurfaceSummary, /selectedLocationsFacet=300000000468243/i)
  assert.match(provider.verifiedSurfaceSummary, /TotalJobsCount=24/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Automation QA Engineer/i)
})

test('Ciklum exact backlog row resolves directly from the local provider metadata', async () => {
  const { CIKLUM_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ciklum\n',
    catalog: [hydrateProviderCatalogEntry(CIKLUM_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ciklum', 'ciklum', 'Ciklum']],
  )
})

test('Ciklum hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { CIKLUM_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CIKLUM_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, CIKLUM_CATALOG.companyCareerPage)
  assert.equal(provider.companyDomain, 'jobs.ciklum.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.match(provider.modulePath, /ciklum[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /ciklum[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
