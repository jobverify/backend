import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes SEOAK as an official careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'seoak')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SEOAK Innovations Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.seoak.in/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'official-nextjs-careers-page+desktop-job-cards+mobile-duplicate-dedupe')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'seoak.in')
  assert.match(provider.modulePath, /seoak[\\/]script\.js$/i)
})

test('SEOAK coverage matches the CSV row and exact alias for SEOAK', () => {
  const scraper = buildScrapers().find((item) => item.name === 'seoak')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /seoak[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'seoak')

  const report = generateCompanyCoverageReport({
    csvText: [
      'SEOAK,',
      'SEOAK Innovations Private Limited,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['SEOAK', 'seoak', 'SEOAK Innovations Private Limited'],
      ['SEOAK Innovations Private Limited', 'seoak', 'SEOAK Innovations Private Limited'],
    ],
  )
})
