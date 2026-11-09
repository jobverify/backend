import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cult.fit as a verified public Zwayam source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cultfit')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.companyName, 'Cult.fit')
  assert.equal(provider.companyCareerPage, 'https://careers.cult.fit/cult/')
  assert.equal(provider.companyDomain, 'careers.cult.fit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'public-zwayam-pagination')
  assert.equal(provider.extractionStrategy, 'verified-first-party-zwayam-careers-page+public-zwayam-apis')
  assert.match(provider.modulePath, /cultfit[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Cult.fit and Cure.fit through the same verified source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cultfit')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cultfit')
  assert.match(scraper.dryRunFile, /cultfit[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Cult.fit,\nCure.fit,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Cult.fit', 'cultfit', 'Cult.fit'],
      ['Cure.fit', 'cultfit', 'Cult.fit'],
    ],
  )
})
