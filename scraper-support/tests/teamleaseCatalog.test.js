import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Teamlease as an official WP Job Openings script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'teamlease')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Teamlease')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.companyCareerPage, 'https://group.teamlease.com/jobs/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'wp-json-page-query')
  assert.equal(
    provider.extractionStrategy,
    'awsm-rest-api+detail-page-inline-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'group.teamlease.com')
  assert.match(provider.modulePath, /teamlease[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Teamlease to the teamlease source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'teamlease')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /teamlease[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'teamlease')

  const report = generateCompanyCoverageReport({
    csvText: 'Teamlease,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Teamlease', 'teamlease', 'Teamlease']],
  )
})
