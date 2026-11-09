import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/gainsight/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gainsight/catalog.js')
  } catch {
    assert.fail('Expected Gainsight catalog module at ../../scraper/gainsight/catalog.js')
  }
}

test('Gainsight local catalog captures the verified empty first-party Jibe shell metadata', async () => {
  const { GAINSIGHT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GAINSIGHT_CATALOG)

  assert.equal(defaultCatalog, GAINSIGHT_CATALOG)
  assert.equal(provider.source, 'gainsight')
  assert.equal(provider.companyName, 'Gainsight')
  assert.equal(provider.officialBrandName, 'Gainsight')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.gainsight.com/')
  assert.equal(provider.companyCareerPage, 'https://www.gainsight.com/company/careers/?gsfrom=staircase')
  assert.equal(provider.officialJobsShellUrl, 'https://careers.gainsight.com/jobs/brands')
  assert.equal(provider.officialLocationsUrl, 'https://careers.gainsight.com/jobs/locations')
  assert.equal(provider.companyDomain, 'gainsight.com')
  assert.equal(provider.atsPlatform, 'first-party-jibe-empty-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-empty-jibe-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-empty-jibe-shell+verified-empty-locations-page+return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /gainsight[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Find Authentic Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /search-results-none/i)
  assert.match(provider.verifiedSurfaceSummary, /No cities/i)
})

test('Gainsight exact backlog row matches directly from local provider metadata', async () => {
  const { GAINSIGHT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Gainsight\n',
    catalog: [hydrateProviderCatalogEntry(GAINSIGHT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Gainsight', 'gainsight', 'Gainsight']],
  )
})

test('Gainsight hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { GAINSIGHT_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GAINSIGHT_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gainsight')
  assert.equal(provider.companyDomain, 'gainsight.com')
  assert.equal(provider.atsPlatform, 'first-party-jibe-empty-shell')
  assert.match(provider.modulePath, /gainsight[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /gainsight[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
