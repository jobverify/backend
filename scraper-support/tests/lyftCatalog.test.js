import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const lyftModulePath = path.resolve(currentDir, '../../scraper/lyft/script.js')

const loadLyftCatalog = async () => {
  try {
    return await import('../../scraper/lyft/catalog.js')
  } catch {
    assert.fail('Expected Lyft catalog module at ../../scraper/lyft/catalog.js')
  }
}

test('Lyft local catalog captures the current declared first-party careers shell and Greenhouse board without alias churn', async () => {
  const {
    LYFT_CATALOG,
    default: defaultCatalog,
  } = await loadLyftCatalog()
  const provider = hydrateProviderCatalogEntry(LYFT_CATALOG)

  assert.equal(defaultCatalog, LYFT_CATALOG)
  assert.equal(provider.source, 'lyft')
  assert.equal(provider.companyName, 'Lyft')
  assert.equal(provider.officialBrandName, 'Lyft, Inc.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.lyft.com/careers')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://api.greenhouse.io/v1/boards/lyft/jobs')
  assert.equal(
    provider.greenhouseJobsApiWithContentUrl,
    'https://api.greenhouse.io/v1/boards/lyft/jobs?content=true',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'paired-current-native-and-published-own-route-original-GETs')
  assert.equal(
    provider.extractionStrategy,
    'full-native-and-published-route-models-before-country-selection',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lyft.com')
  assert.equal(provider.verifiedOn, null)
  assert.match(provider.dryRunFile, /lyft[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /lyft[\\/]script\.js$/i)
  assert.equal(provider.modulePath, lyftModulePath)
  assert.match(provider.verifiedSurfaceSummary, /unqualified/i)
  assert.equal(provider.verifiedInventoryStatus, 'unverified')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.zeroResultPolicy, 'coverage-gap')
})

test('Lyft backlog row matches directly from the local catalog metadata without aliases', async () => {
  const { LYFT_CATALOG } = await loadLyftCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Lyft\n',
    catalog: [hydrateProviderCatalogEntry(LYFT_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lyft', 'lyft', 'Lyft']],
  )
})
