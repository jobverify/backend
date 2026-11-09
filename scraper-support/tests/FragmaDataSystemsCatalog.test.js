import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fragmadatasystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fragmadatasystems/catalog.js')
  } catch {
    assert.fail('Expected Fragma Data Systems catalog module at ../../scraper/fragmadatasystems/catalog.js')
  }
}

test('Fragma Data Systems local catalog captures the careers-email-only fail-closed contract', async () => {
  const { FRAGMA_DATA_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FRAGMA_DATA_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, FRAGMA_DATA_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'fragmadatasystems')
  assert.equal(provider.companyName, 'Fragma Data Systems')
  assert.equal(provider.officialBrandName, 'Fragma Data')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://fragmadata.com/')
  assert.equal(provider.companyCareerPage, 'https://fragmadata.com/careers/')
  assert.equal(provider.companyDomain, 'fragmadata.com')
  assert.equal(provider.atsPlatform, 'first-party-homepage-careers-email-only')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-careers-email-plus-missing-careers-route')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-careers-email-only+verified-404-careers-route+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@fragmadata\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Page not found/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /fragmadatasystems[\\/]jobs\.json$/i)
})

test('Fragma Data Systems backlog row matches directly from the local catalog', async () => {
  const { FRAGMA_DATA_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fragma Data Systems\n',
    catalog: [hydrateProviderCatalogEntry(FRAGMA_DATA_SYSTEMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
