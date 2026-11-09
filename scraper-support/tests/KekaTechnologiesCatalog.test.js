import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kekatechnologies/catalog.js')
  } catch {
    assert.fail('Expected KEKA TECHNOLOGIES catalog module at ../../scraper/kekatechnologies/catalog.js')
  }
}

test('KEKA TECHNOLOGIES catalog captures the verified Keka-hosted careers shell and active jobs contract', async () => {
  const {
    KEKA_TECHNOLOGIES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, KEKA_TECHNOLOGIES_CATALOG)
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.source, 'kekatechnologies')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.companyName, 'KEKA TECHNOLOGIES')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.officialBrandName, 'Keka Technologies Private Limited')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.adapter, 'script')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://hr.keka.com/careers/')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.companyDomain, 'hr.keka.com')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.atsPlatform, 'keka-careers-embed-jobs-api')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.jobsBoardUrl, 'https://hr.keka.com/careers/')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.countryFilter, 'India')
  assert.equal(
    KEKA_TECHNOLOGIES_CATALOG.paginationStrategy,
    'verified-keka-careers-shell-plus-active-jobs-api',
  )
  assert.equal(
    KEKA_TECHNOLOGIES_CATALOG.extractionStrategy,
    'verified-keka-careers-shell+embedded-career-config+active-jobs-api',
  )
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.parser, 'custom-script')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KEKA_TECHNOLOGIES_CATALOG.verifiedOn, '2026-08-07')
  assert.match(KEKA_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /official Keka careers host/i)
  assert.match(KEKA_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /24040a7e-a7c5-47a5-9cd5-019962c66385/i)
  assert.match(KEKA_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /active jobs API/i)
  assert.match(KEKA_TECHNOLOGIES_CATALOG.modulePath, /kekatechnologies[\\/]script\.js$/i)
})

test('KEKA TECHNOLOGIES backlog matching works from the local catalog metadata', async () => {
  const { KEKA_TECHNOLOGIES_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'KEKA TECHNOLOGIES\n',
    catalog: [KEKA_TECHNOLOGIES_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KEKA TECHNOLOGIES', 'kekatechnologies', 'KEKA TECHNOLOGIES']],
  )
})
