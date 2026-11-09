import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes GMMCO as a Darwinbox script provider with verified official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gmmco')

  assert.ok(provider)
  assert.equal(provider.companyName, 'GMMCO')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://www.gmmco.in/about/careers')
  assert.equal(provider.companyDomain, 'gmmco.in')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /gmmco[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve GMMCO without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gmmco')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /gmmco[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'gmmco')

  const report = generateCompanyCoverageReport({
    csvText: 'GMMCO,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GMMCO', 'gmmco', 'GMMCO']],
  )
})
