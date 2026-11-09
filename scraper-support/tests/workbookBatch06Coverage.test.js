import { assertCurrentWorkbookRoute, installWorkbookOfflineGuard } from './helpers/workbookBatchCatalogAssertions20261102.js'
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'

import dedicatedProviders from '../providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import { generateCompanyCoverageReport, getCompanyAliasMap } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const manifest = {
  batch: '06',
  companies: dedicatedProviders
    .filter((provider) => String(provider.originalModulePath || '').startsWith('../workbookbatch06/'))
    .map((provider) => provider.companyName),
}
const FINAL_SENTINEL_DISPOSITION = 'no-trustworthy-exact-name-public-jobs-flow-verified-locally'
const GENERIC_SENTINEL_EXTRACTION_STRATEGY =
  'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified'
const scriptModulePathFor = (source) => `../${source}/script.js`
const hydratedScriptModulePathFor = (source) => path.join(import.meta.dirname, '..', '..', 'scraper', source, 'script.js')

test('workbook batch 06 companies all resolve to providers', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${manifest.companies.join('\n')}\n`,
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
  })

  assert.equal(manifest.batch, '06')
  assert.equal(manifest.companies.length, 33)
  assert.equal(report.matchedCount, manifest.companies.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
})

test('workbook batch 06 providers preserve exact-name coverage while allowing promoted company-local modules', async (t) => {
  const forbidden = installWorkbookOfflineGuard(t)
  const catalog = getScraperCatalog()
  const scrapersByName = new Map(buildScrapers().map((scraper) => [scraper.name, scraper]))
  const report = generateCompanyCoverageReport({
    csvText: `${manifest.companies.join('\n')}\n`,
    catalog,
    aliasMap: getCompanyAliasMap(),
  })
  const batchProviders = report.matched.map(({ source }) => dedicatedProviders.find((provider) => provider.source === source))
  const promotedProviders = batchProviders.filter(
    (provider) => !String(provider.originalModulePath || '').includes('failClosedSentinel.js'),
  )

  assert.equal(batchProviders.length, manifest.companies.length)
  assert.ok(promotedProviders.length >= 1)

  for (const provider of batchProviders) {
    const catalogProvider = catalog.find((item) => item.source === provider.source)
    const scraper = scrapersByName.get(provider.source)
    const historicalProvider = hydrateProviderCatalogEntry(provider)
    const implementation = await assertCurrentWorkbookRoute(catalogProvider, scraper)

    assert.ok(catalogProvider)
    assert.ok(scraper)
    assert.equal(catalogProvider.companyName, provider.companyName)
    assert.equal(historicalProvider.verifiedOn, provider.verifiedOn)
    assert.equal(historicalProvider.modulePath, hydratedScriptModulePathFor(provider.source))

    if (!String(provider.originalModulePath || '').includes('failClosedSentinel.js')) {
      assert.equal(typeof scraper.run, 'function')
      continue
    }

    assert.equal(historicalProvider.verifiedPublicJobCount, 0)
    assert.equal(historicalProvider.verifiedIndiaJobCount, 0)
    assert.equal(historicalProvider.atsPlatform, 'workbook-exact-name-sentinel')
    assert.equal(historicalProvider.originalModulePath, '../workbookbatch06/failClosedSentinel.js')
    assert.equal(historicalProvider.verificationDisposition, FINAL_SENTINEL_DISPOSITION)
    assert.equal(historicalProvider.countryFilter, 'India')
    assert.equal(historicalProvider.paginationStrategy, 'none')
    assert.equal(historicalProvider.extractionStrategy, GENERIC_SENTINEL_EXTRACTION_STRATEGY)
    assert.equal(historicalProvider.companyCareerPage, null)
    assert.equal(historicalProvider.companyDomain, null)
    assert.match(
      historicalProvider.verifiedSurfaceSummary,
      new RegExp(`exact-name sentinel for ${provider.companyName}`),
    )
    if (['sentinel', 'static-empty'].includes(implementation)) {
      assert.deepEqual(await scraper.run({ fetchText: forbidden, fetchJson: forbidden, fetchPage: forbidden }), [])
    }
  }
})
