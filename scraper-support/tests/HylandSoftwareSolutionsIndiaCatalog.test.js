import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hylandsoftwaresolutionsindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hylandsoftwaresolutionsindia/catalog.js')
  } catch {
    assert.fail('Expected Hyland Software Solutions India catalog module at ../../scraper/hylandsoftwaresolutionsindia/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Hyland Software Solutions India LLP local catalog captures the verified first-party careers page and public iCIMS listings surface', async () => {
  const { HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG)

  assert.equal(defaultCatalog, HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG)
  assert.equal(provider.source, 'hylandsoftwaresolutionsindia')
  assert.equal(provider.companyName, 'Hyland Software Solutions India LLP')
  assert.equal(provider.officialBrandName, 'Hyland')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.hyland.com/en')
  assert.equal(provider.companyCareerPage, 'https://www.hyland.com/en/company/careers')
  assert.equal(provider.jobsSearchUrl, 'https://careers-hyland.icims.com/jobs/search?pr=1&in_iframe=1')
  assert.equal(provider.sampleRemoteIndiaJobUrl, 'https://careers-hyland.icims.com/jobs/14187/senior-product-designer---cloud-update-service/job?in_iframe=1')
  assert.equal(provider.sampleHyderabadJobUrl, 'https://careers-hyland.icims.com/jobs/13938/senior-cyber-security-analyst-%28cybersecurity---identity-and-access-management%29/job?in_iframe=1')
  assert.equal(provider.atsPlatform, 'icims')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'icims-next-page-search')
  assert.equal(provider.extractionStrategy, 'first-party-careers-handoff-plus-icims-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hyland.com')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /careers-hyland\.icims\.com\/jobs\/search\?pr=1&in_iframe=1/i)
  assert.match(provider.verifiedSurfaceSummary, /Remote - India openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Hyderabad India Office/i)
})

test('Hyland Software Solutions India LLP exact backlog row resolves from the local provider contract', async () => {
  const { HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Hyland Software Solutions India LLP\n',
    catalog: [buildCatalogReadyProvider(HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hyland Software Solutions India LLP', 'hylandsoftwaresolutionsindia', 'Hyland Software Solutions India LLP']],
  )
})
