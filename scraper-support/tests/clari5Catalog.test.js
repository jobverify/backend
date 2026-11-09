import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Clari5 as a verified first-party careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'clari5')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Clari5')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.clari5.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-paginated-careers-archive-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'verified-homepage+verified-paginated-careers-archive+same-domain-detail-pages+india-location-filter+first-party-apply-form')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'clari5.com')
  assert.match(provider.modulePath, /clari5[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Clari5 rows', () => {
  const scraper = buildScrapers().find((item) => item.name === 'clari5')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /clari5[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'clari5')

  const report = generateCompanyCoverageReport({
    csvText: 'Clari5,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Clari5', 'clari5', 'Clari5']],
  )
})
