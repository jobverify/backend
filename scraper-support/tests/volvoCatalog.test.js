import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Volvo Group as a public native HTML discovery provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'volvo')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Volvo Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'successfactors-public-native-get')
  assert.equal(provider.companyCareerPage, 'https://www.volvogroup.com/en/careers.html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'published-native-table-ranges')
  assert.equal(provider.extractionStrategy, 'native-listings-and-complete-own-models-before-caps')
  assert.equal(provider.parser, 'volvo-native-public-get')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'volvogroup.com')
  assert.match(provider.modulePath, /volvo[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Volvo to the volvo source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'volvo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /volvo[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'volvo')

  const report = generateCompanyCoverageReport({
    csvText: 'Volvo,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Volvo', 'volvo', 'Volvo Group']],
  )
})
