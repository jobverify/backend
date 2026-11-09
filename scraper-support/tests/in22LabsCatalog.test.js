import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('in22Labs is registered as a verified first-party zero-job sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'in22labs')

  assert.ok(provider, 'Expected in22Labs provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'in22Labs')
  assert.equal(provider.companyCareerPage, 'https://in22labs.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'in22labs.com')
  assert.match(provider.modulePath, /in22labs[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'in22Labs'), false)
})

test('in22Labs matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'in22Labs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['in22Labs', 'in22labs', 'in22Labs']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'in22labs')

  assert.ok(scraper, 'Expected buildScrapers() to return the in22Labs scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'in22labs')
  assert.equal(scraper.provider.companyCareerPage, 'https://in22labs.com/')
  assert.match(scraper.dryRunFile, /in22labs[\\/]jobs\.json$/i)
})
