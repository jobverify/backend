import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/coralogix/catalog.js')
  } catch {
    assert.fail('Expected Coralogix catalog module at ../../scraper/coralogix/catalog.js')
  }
}

test('Coralogix catalog captures the verified first-party careers page and India detail pages', async () => {
  const {
    CORALOGIX_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, CORALOGIX_CATALOG)
  assert.equal(CORALOGIX_CATALOG.source, 'coralogix')
  assert.equal(CORALOGIX_CATALOG.companyName, 'Coralogix')
  assert.equal(CORALOGIX_CATALOG.officialBrandName, 'Coralogix')
  assert.equal(CORALOGIX_CATALOG.adapter, 'script')
  assert.equal(CORALOGIX_CATALOG.dryRunFile, 'coralogix/jobs.json')
  assert.equal(CORALOGIX_CATALOG.companyCareerPage, 'https://coralogix.com/careers/')
  assert.equal(CORALOGIX_CATALOG.companyDomain, 'coralogix.com')
  assert.equal(CORALOGIX_CATALOG.atsPlatform, 'official-first-party-careers-page')
  assert.equal(CORALOGIX_CATALOG.countryFilter, 'India')
  assert.equal(
    CORALOGIX_CATALOG.paginationStrategy,
    'single-first-party-open-positions-page+india-detail-pages',
  )
  assert.equal(
    CORALOGIX_CATALOG.extractionStrategy,
    'verified-first-party-open-positions-page+same-domain-role-links+india-location-filter+first-party-detail-pages',
  )
  assert.equal(CORALOGIX_CATALOG.parser, 'custom-script')
  assert.equal(CORALOGIX_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(CORALOGIX_CATALOG.verifiedOn, '2026-07-25')
  assert.equal(CORALOGIX_CATALOG.verifiedPublicJobCount, 3)
  assert.equal(CORALOGIX_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/coralogix\.com\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/coralogix\.com\/careers\/co\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Cloud and Observability Engineer in Gurugram/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Remote, India/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Forward Deployed Engineer in Gurugram/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Coralogix'), false)
})

test('Coralogix exact backlog row resolves from the local provider contract without aliases', async () => {
  const { CORALOGIX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Coralogix\n',
    catalog: [hydrateProviderCatalogEntry(CORALOGIX_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Coralogix', 'coralogix', 'Coralogix']],
  )
})

test('buildScrapers and company coverage resolve Coralogix from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'coralogix')
  const scraper = buildScrapers().find((item) => item.name === 'coralogix')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Coralogix')
  assert.equal(provider.companyCareerPage, 'https://coralogix.com/careers/')
  assert.match(scraper.dryRunFile, /coralogix[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Coralogix\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Coralogix', 'coralogix', 'Coralogix']],
  )
})
