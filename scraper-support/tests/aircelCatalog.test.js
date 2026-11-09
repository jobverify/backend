import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAircelCatalog = async () => {
  try {
    return await import('../../scraper/aircel/catalog.js')
  } catch {
    assert.fail('Expected Aircel catalog module at ../../scraper/aircel/catalog.js')
  }
}

test('Aircel provider metadata captures the verified first-party no-public-careers surface without aliases', async () => {
  const { AIRCEL_CATALOG } = await loadAircelCatalog()
  const provider = hydrateProviderCatalogEntry(AIRCEL_CATALOG)

  assert.equal(provider.source, 'aircel')
  assert.equal(provider.companyName, 'Aircel')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://aircel.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-common-careers-and-crawl-route-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-missing-careers-and-crawl-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aircel.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /aircel[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aircel\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aircel\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aircel\.com\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aircel'), false)
})

test('Aircel backlog row matches directly from provider metadata without alias churn', async () => {
  const { AIRCEL_CATALOG } = await loadAircelCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Aircel\n',
    catalog: [hydrateProviderCatalogEntry(AIRCEL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aircel', 'aircel', 'Aircel']],
  )
})

test('buildScrapers and company coverage resolve Aircel from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aircel')
  const scraper = buildScrapers().find((item) => item.name === 'aircel')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aircel')
  assert.equal(provider.companyCareerPage, 'https://aircel.com/')
  assert.match(scraper.dryRunFile, /aircel[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aircel\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aircel', 'aircel', 'Aircel']],
  )
})
