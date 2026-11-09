import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/campsystemsinternationalinc/catalog.js')
  } catch {
    assert.fail('Expected CAMP Systems International, Inc. catalog module at ../../scraper/campsystemsinternationalinc/catalog.js')
  }
}

test('CAMP Systems International, Inc. local catalog captures the verified first-party careers sentinel contract', async () => {
  const { CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG, default: defaultCatalog } = await loadCatalogModule()

  assert.equal(defaultCatalog, CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG)
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.source, 'campsystemsinternationalinc')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.companyName, 'CAMP Systems International, Inc.')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.officialBrandName, 'CAMP Systems')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.adapter, 'script')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.companyCareerPage, 'https://www.campsystems.com/careers')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.companyDomain, 'campsystems.com')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.atsPlatform, 'ukg-pro')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.countryFilter, 'India')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.paginationStrategy, 'native-unfiltered-search+offset+closing-membership')
  assert.equal(
    CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.extractionStrategy,
    'current-corporate-handoff+anonymous-public-ukg-search+full-bound-role-models',
  )
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.parser, 'custom-script')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.modulePath, '../../scraper/campsystemsinternationalinc/script.js')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.verifiedOn, '2026-11-03')
  assert.equal(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.dryRunFile, 'campsystemsinternationalinc/jobs.json')
  assert.match(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.campsystems\.com\/careers/i)
  assert.match(CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG.verifiedSurfaceSummary, /Find Opportunities/i)
})

test('CAMP Systems International, Inc. exact backlog row resolves directly from local provider metadata', async () => {
  const { CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'CAMP Systems International, Inc.\n',
    catalog: [CAMP_SYSTEMS_INTERNATIONAL_INC_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CAMP Systems International, Inc.', 'campsystemsinternationalinc', 'CAMP Systems International, Inc.']],
  )
})
