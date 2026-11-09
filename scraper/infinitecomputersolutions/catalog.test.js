import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('getScraperCatalog includes Infinite Computer Solutions as an official careers invalid-portal scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'infinitecomputersolutions')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Infinite Computer Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'brassring-public-search-api-location-filter')
  assert.equal(provider.companyCareerPage, 'https://www.infinite.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'infinite.com')
  assert.equal(
    provider.searchResultsUrl,
    'https://sjobs.brassring.com/TGNewUI/Search/Home/Home?partnerid=26656&siteid=5008#keyWordSearch=&locationSearch=India',
  )
  assert.equal(
    provider.searchApiUrl,
    'https://sjobs.brassring.com/TgNewUI/Search/Ajax/ProcessSortAndShowMoreJobs',
  )
  assert.equal(
    provider.paginationStrategy,
    'official-careers-page-plus-public-brassring-search-api-pagination',
  )
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+brassring-landing-session+public-search-api+formtext4-india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.equal(provider.verifiedPublicJobCount, 577)
  assert.equal(provider.verifiedIndiaJobCount, 170)
  assert.match(provider.verifiedSurfaceSummary, /August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /ProcessSortAndShowMoreJobs/i)
  assert.match(provider.modulePath, /infinitecomputersolutions[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Infinite Computer Solutions without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'infinitecomputersolutions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /infinitecomputersolutions[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'infinitecomputersolutions')

  const report = generateCompanyCoverageReport({
    csvText: 'Infinite Computer Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Infinite Computer Solutions', 'infinitecomputersolutions', 'Infinite Computer Solutions']],
  )
})
