import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes UPL as a SuccessFactors script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'upl')

  assert.ok(provider)
  assert.equal(provider.companyName, 'UPL')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, 'https://careers.upl-ltd.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'startrow-query-on-public-html-search')
  assert.equal(
    provider.extractionStrategy,
    'successfactors-search-results-table+detail-pages+talentcommunity-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.upl-ltd.com')
  assert.match(provider.modulePath, /upl[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve UPL to the upl source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'upl')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /upl[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'upl')

  const report = generateCompanyCoverageReport({
    csvText: 'UPL,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['UPL', 'upl', 'UPL']],
  )
})
