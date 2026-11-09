import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAculifeCatalog = async () => {
  try {
    return await import('../../scraper/aculife/catalog.js')
  } catch {
    assert.fail('Expected Aculife catalog module at ../../scraper/aculife/catalog.js')
  }
}

test('Aculife provider metadata captures the verified first-party discovery-only application form without aliases', async () => {
  const { ACULIFE_PROVIDER } = await loadAculifeCatalog()
  const provider = hydrateProviderCatalogEntry(ACULIFE_PROVIDER)

  assert.equal(provider.source, 'aculife')
  assert.equal(provider.companyName, 'Aculife')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.aculife.co.in/resource/career.aspx')
  assert.equal(provider.atsPlatform, 'official-company-site-discovery-only')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-homepage-and-general-application-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-application-form+discovery-only-unknown-vacancy-counts',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aculife.co.in')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedInventoryStatus, 'discovery-only')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.listingComplete, false)
  assert.match(provider.modulePath, /aculife[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 9, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aculife\.co\.in\/resource\/career\.aspx/i)
  assert.match(provider.verifiedSurfaceSummary, /unknown active vacancy counts/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aculife'), false)
})

test('Aculife backlog row matches directly from provider metadata without alias churn', async () => {
  const { ACULIFE_PROVIDER } = await loadAculifeCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Aculife\n',
    catalog: [hydrateProviderCatalogEntry(ACULIFE_PROVIDER)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aculife', 'aculife', 'Aculife']],
  )
})

test('buildScrapers and company coverage resolve Aculife from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aculife')
  const scraper = buildScrapers().find((item) => item.name === 'aculife')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aculife')
  assert.equal(provider.companyCareerPage, 'https://www.aculife.co.in/resource/career.aspx')
  assert.match(scraper.dryRunFile, /aculife[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aculife\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aculife', 'aculife', 'Aculife']],
  )
})
