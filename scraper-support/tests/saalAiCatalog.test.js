import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Saal AI as an official-careers Darwinbox script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'saalai')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Saal AI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://saal.ai/careers/')
  assert.equal(provider.companyDomain, 'saal.ai')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /saalai[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Saal AI without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'saalai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /saalai[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'saalai')

  const report = generateCompanyCoverageReport({
    csvText: 'Saal AI,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Saal AI', 'saalai', 'Saal AI']],
  )
})
