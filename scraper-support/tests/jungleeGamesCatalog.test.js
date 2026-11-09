import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jungleegames/catalog.js')
  } catch {
    assert.fail('Expected Junglee Games catalog module at ../../scraper/jungleegames/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/jungleegames/script.js')
  } catch {
    assert.fail('Expected Junglee Games scraper module at ../../scraper/jungleegames/script.js')
  }
}

test('Junglee Games local catalog captures the verified fail-closed careers contract', async () => {
  const { JUNGLEE_GAMES_CATALOG } = await loadCatalogModule()
  const jungleeGames = await loadScraperModule()

  assert.equal(JUNGLEE_GAMES_CATALOG.source, 'jungleegames')
  assert.equal(JUNGLEE_GAMES_CATALOG.companyName, 'Junglee Games')
  assert.equal(JUNGLEE_GAMES_CATALOG.officialBrandName, 'Junglee Games')
  assert.equal(JUNGLEE_GAMES_CATALOG.adapter, 'script')
  assert.equal(JUNGLEE_GAMES_CATALOG.modulePath, '../../scraper/jungleegames/script.js')
  assert.equal(JUNGLEE_GAMES_CATALOG.homepageUrl, 'https://www.jungleegames.com/')
  assert.equal(JUNGLEE_GAMES_CATALOG.companyCareerPage, 'https://www.jungleegames.com/grow.php')
  assert.equal(
    JUNGLEE_GAMES_CATALOG.verifiedEmptyDepartmentPageUrl,
    'https://www.jungleegames.com/grow-inner-page.php?id=56613313BB',
  )
  assert.equal(JUNGLEE_GAMES_CATALOG.companyDomain, 'jungleegames.com')
  assert.equal(
    JUNGLEE_GAMES_CATALOG.atsPlatform,
    'official-company-site-no-trustworthy-public-jobs',
  )
  assert.equal(JUNGLEE_GAMES_CATALOG.countryFilter, 'India')
  assert.equal(
    JUNGLEE_GAMES_CATALOG.paginationStrategy,
    'verified-homepage-plus-grow-page-plus-empty-department-page-validation',
  )
  assert.equal(
    JUNGLEE_GAMES_CATALOG.extractionStrategy,
    'verified-first-party-grow-surface-without-trustworthy-current-jobs-index-return-empty',
  )
  assert.equal(JUNGLEE_GAMES_CATALOG.parser, 'custom-script')
  assert.equal(JUNGLEE_GAMES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(JUNGLEE_GAMES_CATALOG.verifiedOn, '2026-08-02')
  assert.equal(JUNGLEE_GAMES_CATALOG.dryRunFile, 'jungleegames/jobs.json')
  assert.match(JUNGLEE_GAMES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.jungleegames\.com\/grow\.php/i)
  assert.match(
    JUNGLEE_GAMES_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.jungleegames\.com\/grow-inner-page\.php\?id=56613313BB/i,
  )
  assert.match(JUNGLEE_GAMES_CATALOG.verifiedSurfaceSummary, /Sunday, August 2, 2026/i)
  assert.match(JUNGLEE_GAMES_CATALOG.verifiedSurfaceSummary, /no trustworthy current jobs index/i)

  assert.equal(jungleeGames.PROVIDER_METADATA.source, JUNGLEE_GAMES_CATALOG.source)
  assert.equal(
    jungleeGames.PROVIDER_METADATA.verifiedEmptyDepartmentPageUrl,
    JUNGLEE_GAMES_CATALOG.verifiedEmptyDepartmentPageUrl,
  )
})

test('Junglee Games exact backlog row matches directly from the local catalog without aliases', async () => {
  const { JUNGLEE_GAMES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Junglee Games\n',
    catalog: [JUNGLEE_GAMES_CATALOG],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Junglee Games', 'jungleegames', 'Junglee Games']],
  )
})
