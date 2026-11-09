import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Nivoda as an Ashby script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nivoda')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Nivoda')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.companyCareerPage, 'https://nivoda.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'ashby-public-board-pagination')
  assert.equal(provider.extractionStrategy, 'public-ashby-board-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nivoda.com')
  assert.match(provider.modulePath, /nivoda[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Nivoda to the nivoda source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nivoda')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nivoda[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'nivoda')

  const report = generateCompanyCoverageReport({
    csvText: 'Nivoda,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nivoda', 'nivoda', 'Nivoda']],
  )
})
