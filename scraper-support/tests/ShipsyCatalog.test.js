import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shipsy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shipsy/catalog.js')
  } catch {
    assert.fail('Expected Shipsy catalog module at ../../scraper/shipsy/catalog.js')
  }
}

test('Shipsy local catalog captures the verified first-party careers page and detail pages', async () => {
  const { SHIPSY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SHIPSY_CATALOG)

  assert.equal(defaultCatalog, SHIPSY_CATALOG)
  assert.equal(provider.source, 'shipsy')
  assert.equal(provider.companyName, 'Shipsy')
  assert.equal(provider.officialBrandName, 'Shipsy')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.shipsy.ai/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.shipsy.ai/careers')
  assert.equal(provider.companyDomain, 'shipsy.ai')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-role-links+same-domain-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /shipsy[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Director, Engineering/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer, Core Platform/i)
})

test('Shipsy exact backlog row resolves from the local catalog entry', async () => {
  const { SHIPSY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shipsy\n',
    catalog: [hydrateProviderCatalogEntry(SHIPSY_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shipsy', 'shipsy', 'Shipsy']],
  )
})
