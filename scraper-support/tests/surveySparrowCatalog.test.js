import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes SurveySparrow as a Keka script provider with the expected aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'surveysparrow')

  assert.ok(provider)
  assert.equal(provider.companyName, 'SurveySparrow')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.companyCareerPage, 'https://surveysparrow.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(provider.extractionStrategy, 'window-khConfig+active-keka-embed-api+jobdetails+applyjob')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'surveysparrow.com')
  assert.match(provider.modulePath, /surveysparrow[\\/]script\.js$/i)
  assert.equal(companyAliases['Survey Sparrow'], 'surveysparrow')
  assert.equal(companyAliases.SurveySparrow, 'surveysparrow')
  assert.equal(companyAliases['SURVEYSPARROW PRIVATE LIMITED'], 'surveysparrow')
})

test('buildScrapers and company coverage resolve Survey Sparrow to the SurveySparrow source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'surveysparrow')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /surveysparrow[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'surveysparrow')

  const report = generateCompanyCoverageReport({
    csvText: 'Survey Sparrow,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Survey Sparrow', 'surveysparrow', 'SurveySparrow']],
  )
})
