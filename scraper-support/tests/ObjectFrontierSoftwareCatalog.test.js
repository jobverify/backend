import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/objectfrontiersoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/objectfrontiersoftware/catalog.js')
  } catch {
    assert.fail('Expected Object Frontier Software catalog module at ../../scraper/objectfrontiersoftware/catalog.js')
  }
}

test('Object Frontier Software local catalog captures the parked exact-name domain fail-closed contract', async () => {
  const { OBJECT_FRONTIER_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OBJECT_FRONTIER_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, OBJECT_FRONTIER_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'objectfrontiersoftware')
  assert.equal(provider.companyName, 'Object Frontier Software')
  assert.equal(provider.officialBrandName, 'Object Frontier Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.objectfrontier.com/')
  assert.equal(provider.companyCareerPage, 'https://www.objectfrontier.com/careers')
  assert.equal(provider.parkedLanderUrl, 'https://www.objectfrontier.com/lander')
  assert.equal(provider.companyDomain, 'objectfrontier.com')
  assert.equal(provider.atsPlatform, 'parked-exact-name-domain-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-name-domain-redirects-to-parked-lander')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-and-careers-redirect-shell+verified-lander-parking-page+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /window\.location\.href="\/lander"/i)
  assert.match(provider.verifiedSurfaceSummary, /parking/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /objectfrontiersoftware[\\/]jobs\.json$/i)
})

test('Object Frontier Software backlog row matches directly from the local catalog', async () => {
  const { OBJECT_FRONTIER_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Object Frontier Software\n',
    catalog: [hydrateProviderCatalogEntry(OBJECT_FRONTIER_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
