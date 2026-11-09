import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import dedicatedProviders from '../providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const scraperDir = path.resolve(currentDir, '..', '..', 'scraper')
const EXPECTED_BATCH_COMPANIES = [
  'Banyan Cloud',
  'Wells Fargo Technology',
]

const slugifySource = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '')

const scriptModulePathFor = (source) => `../${source}/script.js`
const hydratedScriptModulePathFor = (source) => path.join(scraperDir, source, 'script.js')

test('workbook batch 07 registers the expected exact-name sentinels', () => {
  const expectedSources = new Set(EXPECTED_BATCH_COMPANIES.map((companyName) => slugifySource(companyName)))
  const providers = dedicatedProviders.filter((provider) => expectedSources.has(provider.source))

  assert.equal(providers.length, EXPECTED_BATCH_COMPANIES.length)
  assert.deepEqual(
    providers.map((provider) => provider.companyName),
    EXPECTED_BATCH_COMPANIES,
  )

  for (const provider of providers) {
    const hydratedProvider = hydrateProviderCatalogEntry(provider)
    assert.equal(provider.source, slugifySource(provider.companyName))
    assert.equal(provider.adapter, 'script')
    assert.equal(provider.modulePath, scriptModulePathFor(provider.source))
    assert.equal(provider.originalModulePath, '../workbookbatch07/failClosedSentinel.js')
    assert.equal(provider.companyCareerPage, undefined)
    assert.equal(provider.companyDomain, undefined)
    assert.equal(provider.atsPlatform, 'workbook-exact-name-sentinel')
    assert.equal(provider.countryFilter, 'India')
    assert.equal(provider.paginationStrategy, 'none')
    assert.equal(
      provider.extractionStrategy,
      'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified',
    )
    assert.equal(provider.parser, 'custom-script')
    assert.equal(provider.normalizationProfile, 'engineering-default')
    assert.equal(provider.verifiedOn, '2026-07-27')
    assert.equal(provider.verifiedPublicJobCount, 0)
    assert.equal(provider.verifiedIndiaJobCount, 0)
    assert.match(provider.verifiedSurfaceSummary, /Workbook batch 07 exact-name sentinel/i)
    assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/)
    assert.match(
      provider.verifiedSurfaceSummary,
      new RegExp(provider.companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
    assert.equal(
      hydratedProvider.dryRunFile,
      path.join(scraperDir, provider.source, 'jobs.json'),
    )
  }
})

test('workbook batch 07 sentinel companies all resolve from the shared catalog', () => {
  const csvText = `company_name\n${EXPECTED_BATCH_COMPANIES.join('\n')}\n`
  const report = generateCompanyCoverageReport({
    csvText,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, EXPECTED_BATCH_COMPANIES.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
  assert.deepEqual(
    report.matched.map((item) => item.companyName),
    EXPECTED_BATCH_COMPANIES,
  )
})

test('workbook batch 07 retains current source routes and checks only remaining sentinels for offline empty results', async (t) => {
  const forbidden = installWorkbookOfflineGuard(t)
  const expectedSources = new Set(
    EXPECTED_BATCH_COMPANIES.map((companyName) => slugifySource(companyName)),
  )
  const scrapers = buildScrapers().filter((scraper) => expectedSources.has(scraper.name))

  assert.equal(scrapers.length, expectedSources.size)

  for (const scraper of scrapers) {
    const implementation = await assertCurrentWorkbookRoute(scraper.provider, scraper)
    assert.equal(scraper.provider.modulePath, hydratedScriptModulePathFor(scraper.name))
    if (['sentinel', 'static-empty'].includes(implementation.type)) {
      assert.equal(scraper.provider.atsPlatform, 'workbook-exact-name-sentinel')
      assert.deepEqual(await scraper.run({ fetchPage: forbidden, fetchJson: forbidden, fetchText: forbidden }), [])
    } else if (scraper.provider.parser === 'runtime-verified-recruitment') {
      assert.equal(scraper.provider.verifiedIndiaJobCount, null)
      assert.equal(scraper.provider.sourceScopeComplete, false)
    }
  }
})
import { installWorkbookOfflineGuard, assertCurrentWorkbookRoute } from './helpers/workbookBatchCatalogAssertions20261102.js'
