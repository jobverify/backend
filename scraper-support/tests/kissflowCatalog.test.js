import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadKissflowCatalog = async () => {
  try {
    return await import('../../scraper/kissflow/catalog.js')
  } catch {
    assert.fail('Expected Kissflow catalog module at ../../scraper/kissflow/catalog.js')
  }
}

test('Kissflow catalog captures the verified official careers page and live first-party role URLs', async () => {
  const {
    KISSFLOW_CATALOG,
    default: defaultCatalog,
  } = await loadKissflowCatalog()

  assert.equal(defaultCatalog, KISSFLOW_CATALOG)
  assert.equal(KISSFLOW_CATALOG.source, 'kissflow')
  assert.equal(KISSFLOW_CATALOG.companyName, 'Kissflow')
  assert.equal(KISSFLOW_CATALOG.officialBrandName, 'Kissflow')
  assert.equal(KISSFLOW_CATALOG.adapter, 'script')
  assert.equal(KISSFLOW_CATALOG.companyCareerPage, 'https://careers.kissflow.com/')
  assert.equal(KISSFLOW_CATALOG.homepageUrl, 'https://kissflow.com/')
  assert.deepEqual(KISSFLOW_CATALOG.verifiedRoleUrls, [
    'https://careers.kissflow.com/solution-advisor',
    'https://careers.kissflow.com/client-director',
  ])
  assert.equal(KISSFLOW_CATALOG.companyDomain, 'kissflow.com')
  assert.equal(KISSFLOW_CATALOG.atsPlatform, 'official-company-site')
  assert.equal(KISSFLOW_CATALOG.countryFilter, 'India')
  assert.equal(
    KISSFLOW_CATALOG.paginationStrategy,
    'single-first-party-open-positions-page-plus-detail-pages',
  )
  assert.equal(
    KISSFLOW_CATALOG.extractionStrategy,
    'verified-careers-page+listing-card-links+detail-pages-with-inline-apply-form',
  )
  assert.equal(KISSFLOW_CATALOG.parser, 'custom-script')
  assert.equal(KISSFLOW_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KISSFLOW_CATALOG.dryRunFile, 'kissflow/jobs.json')
  assert.equal(KISSFLOW_CATALOG.verifiedOn, '2026-08-15')
  assert.match(KISSFLOW_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.kissflow\.com\//i)
  assert.match(KISSFLOW_CATALOG.verifiedSurfaceSummary, /Solution Advisor/i)
  assert.match(KISSFLOW_CATALOG.verifiedSurfaceSummary, /Client Director/i)
  assert.match(KISSFLOW_CATALOG.verifiedSurfaceSummary, /2 public role cards/i)
  assert.match(KISSFLOW_CATALOG.modulePath, /kissflow[\\/]script\.js$/i)
})

test('Kissflow backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { KISSFLOW_CATALOG } = await loadKissflowCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Kissflow\n',
    catalog: [KISSFLOW_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kissflow', 'kissflow', 'Kissflow']],
  )
})
