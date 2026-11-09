import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes OMRON as a SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'omron')

  assert.ok(provider)
  assert.equal(provider.companyName, 'OMRON')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(
    provider.companyCareerPage,
    'https://careers.omron.com/search/?locationsearch=India&q=&searchResultView=LIST&locale=en_US',
  )
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(
    provider.extractionStrategy,
    'successfactors-search-results-table+detail-pages+talentcommunity-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.omron.com')
  assert.match(provider.modulePath, /omron[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve OMRON to the omron source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'omron')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /omron[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'omron')

  const report = generateCompanyCoverageReport({
    csvText: 'OMRON,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OMRON', 'omron', 'OMRON']],
  )
})
