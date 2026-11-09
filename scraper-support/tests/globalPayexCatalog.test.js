import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Global PayEX is registered as a verified first-party zero-job sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'globalpayex')

  assert.ok(provider, 'Expected Global PayEX provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Global PayEX')
  assert.equal(provider.companyCareerPage, 'https://globalpayex.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-broken-careers-route-plus-empty-careers-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-plus-broken-careers-handoff-plus-absent-careers-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'globalpayex.com')
  assert.match(provider.modulePath, /globalpayex[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Global PayEX'), false)
})

test('Global PayEX matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Global PayEX,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Global PayEX', 'globalpayex', 'Global PayEX']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'globalpayex')

  assert.ok(scraper, 'Expected buildScrapers() to return the Global PayEX scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'globalpayex')
  assert.equal(scraper.provider.companyCareerPage, 'https://globalpayex.com/')
  assert.match(scraper.dryRunFile, /globalpayex[\\/]jobs\.json$/i)
})
