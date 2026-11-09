import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes DirectShifts as a public-feed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'directshifts')

  assert.ok(provider)
  assert.equal(provider.companyName, 'DirectShifts')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'directshifts')
  assert.equal(provider.companyCareerPage, 'https://www.directshifts.com/careers')
  assert.equal(provider.companyDomain, 'directshifts.com')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'public-json-feed')
  assert.equal(
    provider.extractionStrategy,
    'public-json-feed+public-detail-pages+detail-page-apply-fallback',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /directshifts[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve DirectShifts to the directshifts source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'directshifts')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /directshifts[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'directshifts')

  const report = generateCompanyCoverageReport({
    csvText: 'DirectShifts,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DirectShifts', 'directshifts', 'DirectShifts']],
  )
})
