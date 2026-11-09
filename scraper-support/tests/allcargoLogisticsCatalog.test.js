import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Allcargo Logistics as a broken Darwinbox tenant monitor', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'allcargologistics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Allcargo Logistics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyCareerPage, 'https://www.allcargologistics.com/about-us/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-broken-darwinbox-monitor')
  assert.equal(provider.extractionStrategy, 'official-careers-page+broken-darwinbox-tenant-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'allcargologistics.com')
  assert.match(provider.modulePath, /allcargologistics[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Allcargo Logistics to allcargologistics', () => {
  const scraper = buildScrapers().find((item) => item.name === 'allcargologistics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /allcargologistics[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'allcargologistics')

  const report = generateCompanyCoverageReport({
    csvText: 'Allcargo Logistics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Allcargo Logistics', 'allcargologistics', 'Allcargo Logistics']],
  )
})
