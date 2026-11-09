import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadMeruCatalog = async () => {
  try {
    return await import('../../scraper/meru/catalog.js')
  } catch {
    assert.fail('Expected Meru catalog module at ../../scraper/meru/catalog.js')
  }
}

test('Meru catalog captures the verified first-party careers handoff and current zero-India Lever state', async () => {
  const {
    MERU_CATALOG,
    default: defaultCatalog,
  } = await loadMeruCatalog()

  assert.equal(defaultCatalog, MERU_CATALOG)
  assert.equal(MERU_CATALOG.source, 'meru')
  assert.equal(MERU_CATALOG.companyName, 'Meru')
  assert.equal(MERU_CATALOG.officialBrandName, 'MERU')
  assert.equal(MERU_CATALOG.adapter, 'script')
  assert.equal(MERU_CATALOG.homepageUrl, 'https://wearemeru.com/')
  assert.equal(MERU_CATALOG.companyCareerPage, 'https://wearemeru.com/careers/')
  assert.equal(MERU_CATALOG.companyDomain, 'wearemeru.com')
  assert.equal(MERU_CATALOG.officialLeverBoardUrl, 'https://jobs.lever.co/wearemeru')
  assert.equal(MERU_CATALOG.leverApiUrl, 'https://api.lever.co/v0/postings/wearemeru?mode=json')
  assert.equal(MERU_CATALOG.atsPlatform, 'lever')
  assert.equal(MERU_CATALOG.countryFilter, 'India')
  assert.equal(MERU_CATALOG.paginationStrategy, 'official-careers-validation-plus-lever-api')
  assert.equal(
    MERU_CATALOG.extractionStrategy,
    'verified-first-party-homepage+verified-first-party-careers-page+verified-lever-board+lever-postings-api+india-location-filter',
  )
  assert.equal(MERU_CATALOG.parser, 'custom-script')
  assert.equal(MERU_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(MERU_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(MERU_CATALOG.dryRunFile, 'meru/jobs.json')
  assert.match(MERU_CATALOG.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(MERU_CATALOG.verifiedSurfaceSummary, /https:\/\/wearemeru\.com\//)
  assert.match(MERU_CATALOG.verifiedSurfaceSummary, /https:\/\/wearemeru\.com\/careers\//)
  assert.match(MERU_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.lever\.co\/wearemeru/)
  assert.match(MERU_CATALOG.verifiedSurfaceSummary, /10 public postings/i)
  assert.match(MERU_CATALOG.verifiedSurfaceSummary, /no India roles/i)
  assert.match(MERU_CATALOG.modulePath, /meru[\\/]script\.js$/i)
})

test('Meru backlog matching works directly from the local catalog metadata', async () => {
  const { MERU_CATALOG } = await loadMeruCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Meru,\n',
    catalog: [MERU_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Meru', 'meru', 'Meru']],
  )
})
