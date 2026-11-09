import { checkCurrentReplay, assertCurrentProvider } from '../native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dagster/catalog.js')
  } catch {
    assert.fail('Expected Dagster catalog module at ../../scraper/dagster/catalog.js')
  }
}

const loadDagsterModule = async () => {
  try {
    return await import('../../scraper/dagster/script.js')
  } catch {
    assert.fail('Expected Dagster scraper module at ../../scraper/dagster/script.js')
  }
}

test('Dagster local catalog captures the verified homepage, Prefect redirect, and empty Greenhouse board surface', async () => {
  const { DAGSTER_CATALOG } = await loadCatalogModule()
  const dagster = await loadDagsterModule()
  const provider = hydrateProviderCatalogEntry(DAGSTER_CATALOG)

  assert.equal(provider.source, 'dagster')
  assert.equal(provider.companyName, 'Dagster')
  assert.equal(provider.officialBrandName, 'Dagster Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://dagster.io/')
  assert.equal(provider.companyCareerPage, 'https://dagster.io/company/careers')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/dagsterlabs')
  assert.equal(provider.companyDomain, 'dagster.io')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.atsPlatform, 'dagster-homepage-plus-empty-greenhouse-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-prefect-redirect-plus-empty-greenhouse-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-plus-prefect-careers-redirect-plus-empty-greenhouse-board-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.modulePath, /dagster[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /dagster[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dagster\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dagster\.io\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/dagsterlabs/i)
  assert.match(provider.verifiedSurfaceSummary, /Data your team trusts\. AI that runs on it\./i)
  assert.match(provider.verifiedSurfaceSummary, /prefect/i)
  assert.match(provider.verifiedSurfaceSummary, /no current openings/i)

  assert.equal(dagster.PROVIDER_METADATA.source, provider.source)
  assert.equal(dagster.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(dagster.CAREERS_URL, provider.companyCareerPage)
  assert.equal(dagster.GREENHOUSE_BOARD_URL, provider.greenhouseBoardUrl)
})

test('dagster: registered native reader clears historical source-coverage claims', () => assertCurrentProvider('dagster'))
