import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadDhandhaniaCatalog = async () => {
  try {
    return await import('../../scraper/dhandhaniainfotech/catalog.js')
  } catch {
    assert.fail('Expected Dhandhania Infotech catalog module at ../../scraper/dhandhaniainfotech/catalog.js')
  }
}

test('Dhandhania Infotech provider metadata captures the verified DhanInfo careers accordion surface', async () => {
  const { DHANDHANIA_INFOTECH_CATALOG } = await loadDhandhaniaCatalog()
  const provider = hydrateProviderCatalogEntry(DHANDHANIA_INFOTECH_CATALOG)

  assert.equal(provider.source, 'dhandhaniainfotech')
  assert.equal(provider.companyName, 'Dhandhania Infotech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://dhaninfo.com/career/')
  assert.equal(provider.companyDomain, 'dhaninfo.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-accordion')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+accordion-job-sections+first-party-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.modulePath, /dhandhaniainfotech[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Business Development Manager/i)
})

test('Dhandhania Infotech backlog row matches directly from the local provider metadata', async () => {
  const { DHANDHANIA_INFOTECH_CATALOG } = await loadDhandhaniaCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Dhandhania Infotech\n',
    catalog: [hydrateProviderCatalogEntry(DHANDHANIA_INFOTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
