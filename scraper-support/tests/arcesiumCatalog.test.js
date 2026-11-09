import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Arcesium as a Greenhouse apiPortal provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arcesium')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Arcesium')
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.companyCareerPage, 'https://www.arcesium.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'api')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'arcesium.com')
})

test('buildScrapers and company coverage resolve Arcesium to the arcesium source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'arcesium')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /arcesium[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'arcesium')

  const report = generateCompanyCoverageReport({
    csvText: 'Arcesium,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arcesium', 'arcesium', 'Arcesium']],
  )
})
