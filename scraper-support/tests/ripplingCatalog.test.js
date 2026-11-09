import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const ripplingModulePath = path.resolve(currentDir, '../../scraper/rippling/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rippling/catalog.js')
  } catch {
    assert.fail('Expected Rippling catalog module at ../../scraper/rippling/catalog.js')
  }
}

const loadRipplingModule = async () => {
  try {
    return await import('../../scraper/rippling/script.js')
  } catch {
    assert.fail('Expected Rippling scraper module at ../../scraper/rippling/script.js')
  }
}

test('Rippling local catalog captures the verified first-party open roles Algolia contract', async () => {
  const { RIPPLING_CATALOG } = await loadCatalogModule()
  const rippling = await loadRipplingModule()
  const provider = hydrateProviderCatalogEntry(RIPPLING_CATALOG)

  assert.equal(provider.source, 'rippling')
  assert.equal(provider.companyName, 'Rippling')
  assert.equal(provider.officialBrandName, 'Rippling')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.rippling.com/')
  assert.equal(provider.companyCareerPage, 'https://www.rippling.com/careers')
  assert.equal(provider.openRolesUrl, 'https://www.rippling.com/careers/open-roles')
  assert.equal(
    provider.algoliaSearchUrl,
    'https://6FNAX3TBEF-dsn.algolia.net/1/indexes/careers_en-US_production/query',
  )
  assert.equal(provider.algoliaApplicationId, '6FNAX3TBEF')
  assert.equal(provider.algoliaApiKey, '416caa4690f002ff6fe4a2097623640b')
  assert.equal(provider.algoliaIndexName, 'careers_en-US_production')
  assert.equal(provider.atsPlatform, 'algolia')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'algolia-direct-index-query-paged')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-open-roles-next-data+algolia-index+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rippling.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, ripplingModulePath)
  assert.match(provider.dryRunFile, /rippling[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rippling\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rippling\.com\/careers\/open-roles/i)
  assert.match(provider.verifiedSurfaceSummary, /careers_en-US_production/i)
  assert.match(provider.verifiedSurfaceSummary, /SDR Manager, Outbound \(India\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer \(HRIS\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore, India/i)

  assert.equal(rippling.PROVIDER_METADATA.source, RIPPLING_CATALOG.source)
  assert.equal(rippling.PROVIDER_METADATA.companyName, RIPPLING_CATALOG.companyName)
  assert.equal(
    rippling.PROVIDER_METADATA.algoliaSearchUrl,
    RIPPLING_CATALOG.algoliaSearchUrl,
  )
})

test('Rippling exact backlog row matches directly from the local catalog without aliases', async () => {
  const { RIPPLING_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rippling\n',
    catalog: [hydrateProviderCatalogEntry(RIPPLING_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rippling', 'rippling', 'Rippling']],
  )
})
