import { assertCurrentWorkbookRoute, installWorkbookOfflineGuard } from './helpers/workbookBatchCatalogAssertions20261102.js'
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import dedicatedProviders from '../providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = fileURLToPath(new URL('.', import.meta.url))
const scraperDir = path.resolve(currentDir, '..', '..', 'scraper')
const manifest = {
  companies: dedicatedProviders
    .filter((provider) => String(provider.originalModulePath || '').startsWith('../workbookbatch03/'))
    .map((provider) => provider.companyName),
}
const providersBySource = new Map(dedicatedProviders.map((provider) => [provider.source, provider]))
const LIVE_SOURCES = new Set(['housr', 'locus'])
const SENTINEL_EXTRACTION_STRATEGY =
  'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified'
const scriptModulePathPatternFor = (source) => new RegExp(`[\\\\/]${source}[\\\\/]script\\.js$`, 'i')

test('Workbook batch 03 retains exact-name provenance and checks promoted routes offline', async (t) => {
  const forbidden = installWorkbookOfflineGuard(t)
  const catalog = getScraperCatalog()
  const scrapersByName = new Map(buildScrapers().map((scraper) => [scraper.name, scraper]))
  const report = generateCompanyCoverageReport({
    csvText: ['company_name', ...manifest.companies].join('\n'),
    catalog,
  })
  const providerExtensions = report.matched
    .filter(({ source }) => !LIVE_SOURCES.has(source))
    .map(({ source }) => providersBySource.get(source))

  assert.equal(providerExtensions.length, manifest.companies.length - LIVE_SOURCES.size)

  for (const providerExtension of providerExtensions) {
    const provider = catalog.find((item) => item.source === providerExtension.source)
    const scraper = scrapersByName.get(providerExtension.source)
    const historicalProvider = hydrateProviderCatalogEntry(providerExtension)
    const implementation = await assertCurrentWorkbookRoute(provider, scraper)

    assert.ok(provider)
    assert.ok(scraper)
    assert.equal(provider.companyName, providerExtension.companyName)
    assert.match(historicalProvider.modulePath, scriptModulePathPatternFor(historicalProvider.source))
    assert.equal(historicalProvider.originalModulePath, '../workbookbatch03/failClosedSentinel.js')
    assert.equal(historicalProvider.dryRunFile, path.join(scraperDir, historicalProvider.source, 'jobs.json'))
    assert.equal(historicalProvider.atsPlatform, 'workbook-exact-name-sentinel')
    assert.equal(historicalProvider.countryFilter, 'India')
    assert.equal(historicalProvider.paginationStrategy, 'none')
    assert.equal(historicalProvider.extractionStrategy, SENTINEL_EXTRACTION_STRATEGY)
    assert.equal(historicalProvider.parser, 'custom-script')
    assert.equal(historicalProvider.normalizationProfile, 'engineering-default')
    assert.equal(historicalProvider.verifiedOn, '2026-07-25')
    assert.equal(historicalProvider.verifiedPublicJobCount, 0)
    assert.equal(historicalProvider.verifiedIndiaJobCount, 0)
    assert.equal(historicalProvider.companyCareerPage, null)
    assert.equal(historicalProvider.companyDomain, null)
    assert.match(historicalProvider.verifiedSurfaceSummary, /exact-name sentinel/i)
    assert.match(
      historicalProvider.verifiedSurfaceSummary,
      new RegExp(historicalProvider.companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
    if (['sentinel', 'static-empty'].includes(implementation)) {
      assert.deepEqual(await scraper.run({ fetchText: forbidden, fetchJson: forbidden, fetchPage: forbidden }), [])
    }
  }
})
