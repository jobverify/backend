import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Apollo 24/7 as a verified no-public-careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'apollo247')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Apollo 24/7')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.apollo247.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-route-validation')
  assert.equal(provider.extractionStrategy, 'verified-first-party-no-public-careers-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'apollo247.com')
  assert.match(provider.modulePath, /apollo247[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Apollo 24/7 to apollo247', () => {
  const scraper = buildScrapers().find((item) => item.name === 'apollo247')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /apollo247[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'apollo247')

  const report = generateCompanyCoverageReport({
    csvText: 'Apollo 24/7,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apollo 24/7', 'apollo247', 'Apollo 24/7']],
  )
})
