import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadIgtSolutionsCatalogModule = async () => {
  try {
    return await import('../../scraper/igtsolutions/catalog.js')
  } catch {
    assert.fail('Expected IGT Solutions catalog module at ../../scraper/igtsolutions/catalog.js')
  }
}

test('IGT Solutions catalog captures the verified no-public-jobs first-party surface from August 2, 2026', async () => {
  const { IGT_SOLUTIONS_CATALOG } = await loadIgtSolutionsCatalogModule()
  const provider = hydrateProviderCatalogEntry(IGT_SOLUTIONS_CATALOG)

  assert.equal(provider.source, 'igtsolutions')
  assert.equal(provider.companyName, 'IGT Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://atain.com/careers/')
  assert.equal(provider.companyDomain, 'atain.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-page-plus-join-form-and-legacy-board-unavailable-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-join-form+verified-legacy-board-unavailable-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.modulePath, /igtsolutions[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/atain\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/atain\.com\/join-the-squad\//i)
  assert.match(provider.verifiedSurfaceSummary, /careers\.igtsolutions\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /SAP/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('IGT Solutions backlog row matches directly from the local catalog metadata without alias help', async () => {
  const { IGT_SOLUTIONS_CATALOG } = await loadIgtSolutionsCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'IGT Solutions\n',
    catalog: [hydrateProviderCatalogEntry(IGT_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IGT Solutions', 'igtsolutions', 'IGT Solutions']],
  )
})

test('getScraperCatalog includes IGT Solutions as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'igtsolutions')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IGT Solutions')
  assert.equal(provider.companyCareerPage, 'https://atain.com/careers/')
  assert.equal(provider.companyDomain, 'atain.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /igtsolutions[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IGT Solutions scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'igtsolutions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'igtsolutions')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /igtsolutions[\\/]jobs\.json$/i)
})
