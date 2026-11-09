import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/radixweb/catalog.js')
  } catch {
    assert.fail('Expected Radixweb catalog module at ../../scraper/radixweb/catalog.js')
  }
}

test('Radixweb catalog captures the verified client-rendered current-openings shell contract', async () => {
  const { RADIXWEB_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RADIXWEB_CATALOG)

  assert.equal(defaultCatalog, RADIXWEB_CATALOG)
  assert.equal(provider.source, 'radixweb')
  assert.equal(provider.companyName, 'Radixweb')
  assert.equal(provider.officialBrandName, 'Radixweb')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://radixweb.com/')
  assert.equal(provider.companyCareerPage, 'https://radixweb.com/current-openings')
  assert.equal(provider.atsPlatform, 'client-rendered-current-openings-shell-no-ssr-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'tez-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-current-openings-shell-without-ssr-job-cards-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'radixweb.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.modulePath, /radixweb[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /radixweb[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/radixweb\.com\/current-openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /tez_app/i)
})

test('Radixweb exact backlog row resolves from the local catalog contract', async () => {
  const { RADIXWEB_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Radixweb\n',
    catalog: [hydrateProviderCatalogEntry(RADIXWEB_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Radixweb', 'radixweb', 'Radixweb']],
  )
})
