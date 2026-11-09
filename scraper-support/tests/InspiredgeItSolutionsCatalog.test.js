import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/inspiredgeitsolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/inspiredgeitsolutions/catalog.js')
  } catch {
    assert.fail('Expected Inspiredge IT Solutions catalog module at ../../scraper/inspiredgeitsolutions/catalog.js')
  }
}

test('Inspiredge IT Solutions local catalog captures the verified first-party jobs archive', async () => {
  const { INSPIREDGE_IT_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(INSPIREDGE_IT_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, INSPIREDGE_IT_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'inspiredgeitsolutions')
  assert.equal(provider.companyName, 'Inspiredge IT Solutions')
  assert.equal(provider.officialBrandName, 'Inspiredge')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://inspiredgeit.com/')
  assert.equal(provider.companyCareerPage, 'https://inspiredgeit.com/jobs/')
  assert.equal(provider.companyDomain, 'inspiredgeit.com')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-archive')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-archive-pagination')
  assert.equal(provider.extractionStrategy, 'paginated-first-party-job-cards+india-location-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /inspiredgeitsolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Telecom Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Visakhapatnam/i)
})

test('Inspiredge IT Solutions exact backlog row resolves from the local provider contract', async () => {
  const { INSPIREDGE_IT_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Inspiredge IT Solutions\n',
    catalog: [hydrateProviderCatalogEntry(INSPIREDGE_IT_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Inspiredge IT Solutions', 'inspiredgeitsolutions', 'Inspiredge IT Solutions']],
  )
})
