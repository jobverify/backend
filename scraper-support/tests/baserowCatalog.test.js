import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/baserow/catalog.js')
  } catch {
    assert.fail('Expected Baserow catalog module at ../../scraper/baserow/catalog.js')
  }
}

test('getScraperCatalog includes Baserow as a first-party script provider pinned to the verified jobs page', async () => {
  const { BASEROW_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = getScraperCatalog().find((item) => item.source === 'baserow')

  assert.equal(defaultCatalog, BASEROW_CATALOG)
  assert.ok(provider, 'Expected Baserow provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Baserow')
  assert.equal(provider.officialBrandName, 'Baserow')
  assert.equal(provider.companyCareerPage, 'https://baserow.io/jobs')
  assert.equal(provider.companyDomain, 'baserow.io')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-page-current-empty-india-slice')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+same-domain-job-detail-page+return-empty-when-no-india-locations',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /baserow[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /baserow[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/baserow\.io\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /\b1 public opening\b/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India locations/i)
})

test('buildScrapers exposes a runnable Baserow scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'baserow')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /baserow[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'baserow')
  assert.equal(scraper.provider.companyCareerPage, 'https://baserow.io/jobs')
})
