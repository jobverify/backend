import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes NewRocket on the verified first-party careers and apply-now Greenhouse handoff', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'newrocket')

  assert.ok(provider, 'Expected NewRocket provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NewRocket')
  assert.equal(provider.companyCareerPage, 'https://www.newrocket.com/careers')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-plus-careers-plus-apply-now-plus-single-greenhouse-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers+verified-apply-now+greenhouse-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'newrocket.com')
  assert.match(provider.modulePath, /newrocket[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable NewRocket scraper and company coverage resolves the exact CSV row', () => {
  const scraper = buildScrapers().find((item) => item.name === 'newrocket')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'newrocket')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /newrocket[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'NewRocket,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NewRocket', 'newrocket', 'NewRocket']],
  )
})
