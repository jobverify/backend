import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import dedicatedProviders from '../providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = fileURLToPath(new URL('.', import.meta.url))
const batch08Providers = dedicatedProviders.filter(
  (provider) => provider.originalModulePath === '../../scraper/workbookbatch08/failClosedSentinel.js',
)
const manifest = {
  batch: '08',
  companies: batch08Providers.map((provider) => provider.companyName),
  sources: batch08Providers.map((provider) => provider.source),
  providerCount: batch08Providers.length,
}
const scraperDir = path.resolve(currentDir, '..', '..', 'scraper')
const scriptModulePathFor = (source) => `../${source}/script.js`

test('workbook batch 08 registers the expected exact-name sentinels', () => {
  const providers = dedicatedProviders.filter((provider) => manifest.sources.includes(provider.source))

  assert.equal(manifest.batch, '08')
  assert.equal(providers.length, manifest.providerCount)
  assert.deepEqual(
    providers.map((provider) => provider.companyName).sort((left, right) => left.localeCompare(right)),
    [...manifest.companies].sort((left, right) => left.localeCompare(right)),
  )
  assert.deepEqual(
    providers.map((provider) => provider.source).sort((left, right) => left.localeCompare(right)),
    [...manifest.sources].sort((left, right) => left.localeCompare(right)),
  )

  for (const provider of providers) {
    const hydratedProvider = hydrateProviderCatalogEntry(provider)

    assert.equal(provider.adapter, 'script')
    assert.equal(provider.modulePath, scriptModulePathFor(provider.source))
    assert.equal(provider.originalModulePath, '../../scraper/workbookbatch08/failClosedSentinel.js')
    assert.equal(provider.atsPlatform, 'workbook-exact-name-sentinel')
    assert.equal(provider.countryFilter, 'India')
    assert.equal(provider.paginationStrategy, 'none')
    assert.equal(
      provider.extractionStrategy,
      'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified',
    )
    assert.equal(provider.parser, 'custom-script')
    assert.equal(provider.normalizationProfile, 'engineering-default')
    assert.equal(provider.verifiedOn, '2026-07-29')
    assert.equal(provider.verifiedPublicJobCount, 0)
    assert.equal(provider.verifiedIndiaJobCount, 0)
    assert.match(provider.verifiedSurfaceSummary, /Workbook batch 08 exact-name sentinel/i)
    assert.match(provider.verifiedSurfaceSummary, /Wednesday, July 29, 2026/)
    assert.match(
      provider.verifiedSurfaceSummary,
      new RegExp(provider.companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
    assert.equal(
      hydratedProvider.dryRunFile,
      path.join(scraperDir, provider.source, 'jobs.json'),
    )
    assert.equal(existsSync(hydratedProvider.dryRunFile), true)
  }
})

test('workbook batch 08 sentinel companies all resolve from the shared catalog', () => {
  const csvText = `company_name\n${manifest.companies.join('\n')}\n`
  const report = generateCompanyCoverageReport({
    csvText,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, manifest.companies.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
  assert.deepEqual(
    report.matched.map((item) => item.companyName),
    manifest.companies,
  )
})

test('workbook batch 08 sentinel scrapers stay registered and fail closed with zero jobs', async () => {
  const expectedSources = new Set(manifest.sources)
  const scrapers = buildScrapers().filter((scraper) => expectedSources.has(scraper.name))

  assert.equal(scrapers.length, expectedSources.size)

  for (const scraper of scrapers) {
    assert.equal(scraper.provider.modulePath, scriptModulePathFor(scraper.name))
    assert.equal(scraper.provider.atsPlatform, 'workbook-exact-name-sentinel')
    assert.deepEqual(await scraper.run(), [])
  }
})
