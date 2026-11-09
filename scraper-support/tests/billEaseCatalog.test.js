import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes BillEase on the official careers page backed by a public Manatal board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'billease')

  assert.ok(provider)
  assert.equal(provider.companyName, 'BillEase')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'manatal-careers-page')
  assert.equal(provider.companyCareerPage, 'https://billease.ph/careers/')
  assert.equal(provider.companyDomain, 'billease.ph')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'all-public-manatal-pages+closing-native-and-corporate-reconciliation')
  assert.equal(provider.extractionStrategy, 'visible-corporate-role-binding+native-country+full-role-details')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /billease[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve BillEase without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'billease')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /billease[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'billease')

  const report = generateCompanyCoverageReport({
    csvText: 'BillEase,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
