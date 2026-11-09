import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Synamedia as an official-careers Darwinbox script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'synamedia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Synamedia')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://www.synamedia.com/careers/')
  assert.equal(provider.companyDomain, 'synamedia.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /synamedia[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Synamedia without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'synamedia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /synamedia[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'synamedia')

  const report = generateCompanyCoverageReport({
    csvText: 'Synamedia,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Synamedia', 'synamedia', 'Synamedia']],
  )
})
