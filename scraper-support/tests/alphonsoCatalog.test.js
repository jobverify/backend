import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAlphonsoCatalog = async () => {
  try {
    return await import('../../scraper/alphonso/catalog.js')
  } catch {
    assert.fail('Expected Alphonso catalog module at ../../scraper/alphonso/catalog.js')
  }
}

test('Alphonso catalog captures the verified first-party careers redirect and Ashby handoff metadata', async () => {
  const {
    ALPHONSO_CATALOG,
    default: defaultCatalog,
  } = await loadAlphonsoCatalog()

  assert.equal(defaultCatalog, ALPHONSO_CATALOG)
  assert.equal(ALPHONSO_CATALOG.source, 'alphonso')
  assert.equal(ALPHONSO_CATALOG.companyName, 'Alphonso')
  assert.equal(ALPHONSO_CATALOG.officialBrandName, 'LG Ad Solutions')
  assert.equal(ALPHONSO_CATALOG.legalEntityName, 'Alphonso Inc.')
  assert.equal(ALPHONSO_CATALOG.adapter, 'script')
  assert.equal(ALPHONSO_CATALOG.companyCareerPage, 'https://alphonso.tv/careers')
  assert.equal(ALPHONSO_CATALOG.companyDomain, 'alphonso.tv')
  assert.equal(ALPHONSO_CATALOG.officialHomepageUrl, 'https://alphonso.tv/')
  assert.equal(ALPHONSO_CATALOG.parentCareersPage, 'https://lgads.tv/careers/')
  assert.equal(ALPHONSO_CATALOG.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/lgads')
  assert.equal(
    ALPHONSO_CATALOG.ashbyJobBoardUrl,
    'https://api.ashbyhq.com/posting-api/job-board/lgads',
  )
  assert.equal(ALPHONSO_CATALOG.atsPlatform, 'ashby')
  assert.equal(ALPHONSO_CATALOG.countryFilter, 'India')
  assert.equal(
    ALPHONSO_CATALOG.paginationStrategy,
    'verified-first-party-careers-redirect-plus-public-ashby-job-board',
  )
  assert.equal(
    ALPHONSO_CATALOG.extractionStrategy,
    'verified-homepage+verified-parent-careers-redirect+verified-ashby-embed+ashby-job-board-api+india-location-filter',
  )
  assert.equal(ALPHONSO_CATALOG.parser, 'custom-script')
  assert.equal(ALPHONSO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ALPHONSO_CATALOG.verifiedOn, '2026-07-15')
  assert.match(ALPHONSO_CATALOG.verifiedSurfaceSummary, /https:\/\/alphonso\.tv\//i)
  assert.match(ALPHONSO_CATALOG.verifiedSurfaceSummary, /https:\/\/alphonso\.tv\/careers/i)
  assert.match(ALPHONSO_CATALOG.verifiedSurfaceSummary, /https:\/\/lgads\.tv\/careers\//i)
  assert.match(ALPHONSO_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/lgads\/embed/i)
  assert.match(
    ALPHONSO_CATALOG.verifiedSurfaceSummary,
    /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/lgads/i,
  )
  assert.match(ALPHONSO_CATALOG.verifiedSurfaceSummary, /Bangalore/i)
  assert.match(ALPHONSO_CATALOG.modulePath, /alphonso[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Alphonso'), false)
})

test('Alphonso backlog matching works directly from the local catalog metadata', async () => {
  const { ALPHONSO_CATALOG } = await loadAlphonsoCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Alphonso\n',
    catalog: [ALPHONSO_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alphonso', 'alphonso', 'Alphonso']],
  )
})

test('buildScrapers and company coverage resolve Alphonso from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alphonso')
  const scraper = buildScrapers().find((item) => item.name === 'alphonso')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Alphonso')
  assert.equal(provider.companyCareerPage, 'https://alphonso.tv/careers')
  assert.match(scraper.dryRunFile, /alphonso[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Alphonso\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alphonso', 'alphonso', 'Alphonso']],
  )
})
