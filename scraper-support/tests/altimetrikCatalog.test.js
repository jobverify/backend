import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Altimetrik as an official RippleHire-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'altimetrik')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Altimetrik')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ripplehire')
  assert.equal(provider.companyCareerPage, 'https://www.altimetrik.com/careers/')
  assert.equal(provider.companyDomain, 'altimetrik.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-param-on-public-ripplehire-board')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+ripplehire-list-detail-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.match(provider.modulePath, /altimetrik[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Altimetrik to the altimetrik source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'altimetrik')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /altimetrik[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'altimetrik')
  assert.equal(scraper.provider.atsPlatform, 'ripplehire')

  const report = generateCompanyCoverageReport({
    csvText: 'Altimetrik,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [['Altimetrik', 'altimetrik', 'Altimetrik']],
  )
})
