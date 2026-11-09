import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes T-Works as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tsworks')

  assert.ok(provider)
  assert.equal(provider.companyName, 'T-Works')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://tworks.telangana.gov.in/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-closed-state-or-openings-handoff')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-closed-applications-or-openings-page-with-first-party-pdf-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tworks.telangana.gov.in')
  assert.match(provider.modulePath, /tsworks[\\/]script\.js$/i)
})

test('TSWorks coverage resolves from the source slug and official brand name without an alias entry', () => {
  const catalog = getScraperCatalog()
  const scraper = buildScrapers().find((item) => item.name === 'tsworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tsworks[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: [
      'row,company_name',
      '1,TSWorks',
      '2,T-Works',
    ].join('\n'),
    catalog,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['TSWorks', 'tsworks', 'T-Works'],
      ['T-Works', 'tsworks', 'T-Works'],
    ],
  )
})
