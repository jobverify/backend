import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/futuresoftindia/catalog.js')
  } catch {
    assert.fail('Expected FutureSoft India catalog module at ../../scraper/futuresoftindia/catalog.js')
  }
}

test('FutureSoft India local catalog captures the verified first-party careers zero-row sentinel contract', async () => {
  const { FUTURESOFT_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()

  assert.equal(defaultCatalog, FUTURESOFT_INDIA_CATALOG)
  assert.equal(FUTURESOFT_INDIA_CATALOG.source, 'futuresoftindia')
  assert.equal(FUTURESOFT_INDIA_CATALOG.companyName, 'FutureSoft India')
  assert.equal(FUTURESOFT_INDIA_CATALOG.officialBrandName, 'FutureSoft India')
  assert.equal(FUTURESOFT_INDIA_CATALOG.adapter, 'script')
  assert.equal(FUTURESOFT_INDIA_CATALOG.companyCareerPage, 'https://futuresoftindia.com/careers/')
  assert.equal(FUTURESOFT_INDIA_CATALOG.companyDomain, 'futuresoftindia.com')
  assert.equal(FUTURESOFT_INDIA_CATALOG.atsPlatform, 'official-company-careers-zero-results')
  assert.equal(FUTURESOFT_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(FUTURESOFT_INDIA_CATALOG.paginationStrategy, 'verified-first-party-careers-table-zero-row-state')
  assert.equal(
    FUTURESOFT_INDIA_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-filter-options+zero-rendered-job-rows-return-empty',
  )
  assert.equal(FUTURESOFT_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(FUTURESOFT_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FUTURESOFT_INDIA_CATALOG.modulePath, '../../scraper/futuresoftindia/script.js')
  assert.equal(FUTURESOFT_INDIA_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(FUTURESOFT_INDIA_CATALOG.dryRunFile, 'futuresoftindia/jobs.json')
  assert.match(FUTURESOFT_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/futuresoftindia\.com\/careers\//i)
  assert.match(FUTURESOFT_INDIA_CATALOG.verifiedSurfaceSummary, /Job Code/i)
})

test('FutureSoft India exact backlog row resolves directly from local provider metadata', async () => {
  const { FUTURESOFT_INDIA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'FutureSoft India\n',
    catalog: [FUTURESOFT_INDIA_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FutureSoft India', 'futuresoftindia', 'FutureSoft India']],
  )
})
