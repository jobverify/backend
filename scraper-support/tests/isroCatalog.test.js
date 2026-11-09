import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes ISRO with its verified careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'isro')

  assert.ok(provider, 'Expected ISRO provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'ISRO')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-government-careers')
  assert.equal(provider.companyCareerPage, 'https://www.isro.gov.in/Careers.html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-view-all-opportunities-table')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-current-opportunities-page+verified-view-all-opportunities-table+detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'isro.gov.in')
  assert.match(provider.modulePath, /isro[\\/]script\.js$/i)
})

test('buildScrapers exposes the ISRO scraper through the existing runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'isro')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.companyName, 'ISRO')
})

test('generateCompanyCoverageReport matches the exact CSV company name ISRO to the isro source', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'ISRO,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['ISRO', 'isro'],
  ])
})
