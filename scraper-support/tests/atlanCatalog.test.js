import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Atlan as a verified Ashby-backed first-party careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'atlan')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Atlan')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.companyCareerPage, 'https://atlan.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-ashby-job-board')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+ashby-job-board-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'atlan.com')
  assert.match(provider.modulePath, /atlan[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Atlan to atlan', () => {
  const scraper = buildScrapers().find((item) => item.name === 'atlan')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /atlan[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'atlan')

  const report = generateCompanyCoverageReport({
    csvText: 'Atlan,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Atlan', 'atlan', 'Atlan']],
  )
})
