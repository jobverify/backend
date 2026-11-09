import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/codeclouds/catalog.js')
  } catch {
    assert.fail('Expected CodeClouds catalog module at ../../scraper/codeclouds/catalog.js')
  }
}

test('CodeClouds local catalog captures the verified zero-results first-party jobs contract', async () => {
  const { CODECLOUDS_CATALOG, default: defaultCatalog } = await loadCatalogModule()

  assert.equal(defaultCatalog, CODECLOUDS_CATALOG)
  assert.equal(CODECLOUDS_CATALOG.source, 'codeclouds')
  assert.equal(CODECLOUDS_CATALOG.companyName, 'CodeClouds')
  assert.equal(CODECLOUDS_CATALOG.officialBrandName, 'CodeClouds')
  assert.equal(CODECLOUDS_CATALOG.adapter, 'script')
  assert.equal(CODECLOUDS_CATALOG.companyCareerPage, 'https://careers.codeclouds.com/jobs/')
  assert.equal(CODECLOUDS_CATALOG.companyDomain, 'careers.codeclouds.com')
  assert.equal(CODECLOUDS_CATALOG.atsPlatform, 'official-company-careers-zero-results')
  assert.equal(CODECLOUDS_CATALOG.countryFilter, 'India')
  assert.equal(CODECLOUDS_CATALOG.paginationStrategy, 'verified-first-party-zero-results-page')
  assert.equal(
    CODECLOUDS_CATALOG.extractionStrategy,
    'verified-first-party-jobs-page+verified-zero-results-state-return-empty',
  )
  assert.equal(CODECLOUDS_CATALOG.parser, 'custom-script')
  assert.equal(CODECLOUDS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(CODECLOUDS_CATALOG.modulePath, '../../scraper/codeclouds/script.js')
  assert.equal(CODECLOUDS_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(CODECLOUDS_CATALOG.dryRunFile, 'codeclouds/jobs.json')
  assert.match(CODECLOUDS_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.codeclouds\.com\/jobs\//i)
  assert.match(CODECLOUDS_CATALOG.verifiedSurfaceSummary, /No jobs found with current filters/i)
})

test('CodeClouds exact backlog row resolves directly from local provider metadata', async () => {
  const { CODECLOUDS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'CodeClouds\n',
    catalog: [CODECLOUDS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CodeClouds', 'codeclouds', 'CodeClouds']],
  )
})
