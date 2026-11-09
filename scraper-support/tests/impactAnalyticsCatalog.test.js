import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Impact Analytics as a Keka script provider with narrow aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'impactanalytics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Impact Analytics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.companyCareerPage, 'https://www.impactanalytics.ai/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(provider.extractionStrategy, 'window-khConfig+active-keka-embed-api+jobdetails+applyjob')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'impactanalytics.ai')
  assert.match(provider.modulePath, /impactanalytics[\\/]script\.js$/i)
  assert.equal(companyAliases['Impact Analytics'], 'impactanalytics')
  assert.equal(companyAliases['Impact Analytics™'], 'impactanalytics')
})

test('buildScrapers and company coverage resolve Impact Analytics to the impactanalytics source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'impactanalytics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /impactanalytics[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'impactanalytics')

  const report = generateCompanyCoverageReport({
    csvText: 'Impact Analytics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Impact Analytics', 'impactanalytics', 'Impact Analytics']],
  )
})
