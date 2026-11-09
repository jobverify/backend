import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes SecureLayer7 Technologies as an official careers-page script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'securelayer7technologies')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SecureLayer7 Technologies Pvt. Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://securelayer7.net/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+embedded-positions-json+jobposting-schema-country-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'securelayer7.net')
  assert.match(provider.modulePath, /securelayer7technologies[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve SecureLayer7 Technologies Pvt. Ltd without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'securelayer7technologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /securelayer7technologies[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'securelayer7technologies')

  const report = generateCompanyCoverageReport({
    csvText: 'SecureLayer7 Technologies Pvt. Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'SecureLayer7 Technologies Pvt. Ltd',
      'securelayer7technologies',
      'SecureLayer7 Technologies Pvt. Ltd',
    ]],
  )
})
