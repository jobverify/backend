import assert from 'node:assert/strict'
import test from 'node:test'

import { getCompanyAliasMap, generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/temporal/catalog.js')
  } catch {
    assert.fail('Expected Temporal catalog module at ../../scraper/temporal/catalog.js')
  }
}

test('Temporal local catalog captures the verified first-party about page and Greenhouse jobs API', async () => {
  const { TEMPORAL_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TEMPORAL_CATALOG)

  assert.equal(defaultCatalog, TEMPORAL_CATALOG)
  assert.equal(provider.source, 'temporal')
  assert.equal(provider.companyName, 'Temporal')
  assert.equal(provider.officialBrandName, 'Temporal')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://temporal.io/about')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/temporaltechnologies')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/temporaltechnologies/jobs',
  )
  assert.equal(provider.companyDomain, 'temporal.io')
  assert.equal(provider.officialJobBoardDomain, 'job-boards.greenhouse.io')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-board-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+official-greenhouse-board+official-greenhouse-board-api+india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-03')
  assert.match(provider.modulePath, /temporal[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /temporal[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /September 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/temporal\.io\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/temporaltechnologies/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/temporaltechnologies\/jobs\?content=true/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /previously public board has been retired/i)
})

test('getScraperCatalog includes Temporal as a runnable script provider and resolves exact-name aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'temporal')
  const aliases = getCompanyAliasMap()
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nTemporal\nTemporal Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.ok(provider, 'Expected Temporal provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Temporal')
  assert.equal(provider.companyCareerPage, 'https://temporal.io/careers')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.match(provider.modulePath, /temporal[\\/]publishing-gap-script\.js$/i)

  assert.equal(aliases['Temporal Technologies'], 'temporal')
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Temporal', 'temporal', 'Temporal'],
      ['Temporal Technologies', 'temporal', 'Temporal'],
    ],
  )
})

test('buildScrapers exposes a runnable Temporal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'temporal')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'temporal')
  assert.match(scraper.dryRunFile, /temporal[\\/]jobs\.json$/i)
})
