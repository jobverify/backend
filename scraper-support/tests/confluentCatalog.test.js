import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Confluent as a verified Ashby-backed source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'confluent')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Confluent')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.companyCareerPage, 'https://careers.confluent.io/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'ashby-public-board-pagination')
  assert.equal(provider.extractionStrategy, 'public-ashby-board-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.confluent.io')
  assert.match(provider.modulePath, /confluent[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Confluent rows to confluent', () => {
  const scraper = buildScrapers().find((item) => item.name === 'confluent')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /confluent[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'confluent')

  const report = generateCompanyCoverageReport({
    csvText: 'Confluent,\nConfluent India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Confluent', 'confluent', 'Confluent'],
      ['Confluent India', 'confluent', 'Confluent'],
    ],
  )
})
