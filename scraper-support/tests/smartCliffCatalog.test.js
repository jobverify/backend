import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes SmartCliff on the verified official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'smartcliff')

  assert.ok(provider, 'Expected SmartCliff provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SmartCliff Learning Solutions LLP')
  assert.equal(provider.companyCareerPage, 'https://smartcliff.in/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell-zero-public-job-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'smartcliff.in')
  assert.match(provider.modulePath, /smartcliff[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable SmartCliff scraper and exact CSV coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'smartcliff')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'smartcliff')
  assert.match(scraper.dryRunFile, /smartcliff[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'SmartCliff Learning Solutions LLP,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SmartCliff Learning Solutions LLP', 'smartcliff', 'SmartCliff Learning Solutions LLP']],
  )
})
