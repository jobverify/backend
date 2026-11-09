import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Silvermine on the verified official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'silvermine')

  assert.ok(provider, 'Expected Silvermine provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Silvermine Group LLC')
  assert.equal(provider.companyCareerPage, 'https://www.silverminegroup.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell-zero-public-job-listings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'silverminegroup.com')
  assert.match(provider.modulePath, /silvermine[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Silvermine scraper and exact CSV coverage works without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'silvermine')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'silvermine')
  assert.match(scraper.dryRunFile, /silvermine[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Silvermine,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Silvermine', 'silvermine', 'Silvermine Group LLC']],
  )
})
