import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes GroupM on the verified WPP Media careers page backed by the APAC Greenhouse board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'groupm')

  assert.ok(provider, 'Expected GroupM provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GroupM')
  assert.equal(provider.companyCareerPage, 'https://www.wppmedia.com/careers')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-page-plus-single-greenhouse-board')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+greenhouse-jobs-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'wppmedia.com')
  assert.match(provider.modulePath, /groupm[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GroupM scraper and company coverage resolves the exact CSV row without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'groupm')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'groupm')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /groupm[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'GroupM,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GroupM', 'groupm', 'GroupM']],
  )
})
