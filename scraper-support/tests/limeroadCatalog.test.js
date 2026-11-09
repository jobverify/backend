import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadLimeRoadCatalog = async () => {
  try {
    return await import('../../scraper/limeroad/catalog.js')
  } catch {
    assert.fail('Expected LimeRoad catalog module at ../../scraper/limeroad/catalog.js')
  }
}

test('LimeRoad catalog captures the verified first-party careers page and static role surface', async () => {
  const {
    LIMEROAD_CATALOG,
    default: defaultCatalog,
  } = await loadLimeRoadCatalog()

  assert.equal(defaultCatalog, LIMEROAD_CATALOG)
  assert.equal(LIMEROAD_CATALOG.source, 'limeroad')
  assert.equal(LIMEROAD_CATALOG.companyName, 'LimeRoad')
  assert.equal(LIMEROAD_CATALOG.officialBrandName, 'LimeRoad')
  assert.equal(LIMEROAD_CATALOG.adapter, 'script')
  assert.equal(LIMEROAD_CATALOG.companyCareerPage, 'https://www.limeroad.com/careers')
  assert.equal(LIMEROAD_CATALOG.homepageUrl, 'https://www.limeroad.com/')
  assert.deepEqual(LIMEROAD_CATALOG.verifiedRoleUrls, [
    'https://www.limeroad.com/careers',
  ])
  assert.equal(LIMEROAD_CATALOG.companyDomain, 'limeroad.com')
  assert.equal(LIMEROAD_CATALOG.atsPlatform, 'official-company-site')
  assert.equal(LIMEROAD_CATALOG.countryFilter, 'India')
  assert.equal(
    LIMEROAD_CATALOG.paginationStrategy,
    'single-static-first-party-careers-page',
  )
  assert.equal(
    LIMEROAD_CATALOG.extractionStrategy,
    'verified-careers-page+static-role-block',
  )
  assert.equal(LIMEROAD_CATALOG.parser, 'custom-script')
  assert.equal(LIMEROAD_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(LIMEROAD_CATALOG.dryRunFile, 'limeroad/jobs.json')
  assert.equal(LIMEROAD_CATALOG.verifiedOn, '2026-07-16')
  assert.match(LIMEROAD_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.limeroad\.com\/careers/i)
  assert.match(LIMEROAD_CATALOG.verifiedSurfaceSummary, /Customer Support Representative/i)
  assert.match(LIMEROAD_CATALOG.verifiedSurfaceSummary, /Any Graduate - Any Specialization/i)
  assert.match(LIMEROAD_CATALOG.modulePath, /limeroad[\\/]script\.js$/i)
})

test('LimeRoad backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { LIMEROAD_CATALOG } = await loadLimeRoadCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'LimeRoad\n',
    catalog: [LIMEROAD_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LimeRoad', 'limeroad', 'LimeRoad']],
  )
})
