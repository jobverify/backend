import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAirbaseCatalog = async () => {
  try {
    return await import('../../scraper/airbase/catalog.js')
  } catch {
    assert.fail('Expected Airbase catalog module at ../../scraper/airbase/catalog.js')
  }
}

test('Airbase provider metadata captures the current native recovery and unresolved broader hiring scope without aliases', async () => {
  const { AIRBASE_CATALOG } = await loadAirbaseCatalog()
  const provider = hydrateProviderCatalogEntry(AIRBASE_CATALOG)

  assert.equal(provider.source, 'airbase')
  assert.equal(provider.companyName, 'Airbase')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.airbase.com/careers')
  assert.equal(provider.atsPlatform, 'paylocity-public-native-parent-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'full-parent-native-board+own-India-details-and-application-questions+closing-before-caps')
  assert.equal(
    provider.extractionStrategy,
    'current-corporate-parent-redirect+exact-native-tenant+own-employer-brand-and-country+complete-published-criteria',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'airbase.com')
  assert.equal(provider.parentCareersPage, 'https://www.paylocity.com/company/careers/')
  assert.match(provider.modulePath, /airbase[\\/]script\.js$/i)
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.airbase\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.paylocity\.com\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /parent board total is not an Airbase total/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Airbase'), false)
})

test('Airbase backlog row matches directly from provider metadata without alias churn', async () => {
  const { AIRBASE_CATALOG } = await loadAirbaseCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Airbase\n',
    catalog: [hydrateProviderCatalogEntry(AIRBASE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airbase', 'airbase', 'Airbase']],
  )
})

test('buildScrapers and company coverage resolve Airbase from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'airbase')
  const scraper = buildScrapers().find((item) => item.name === 'airbase')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Airbase')
  assert.equal(provider.companyCareerPage, 'https://www.airbase.com/careers')
  assert.match(scraper.dryRunFile, /airbase[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airbase\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airbase', 'airbase', 'Airbase']],
  )
})
