import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Simnovus is registered as a first-party careers-page script provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'simnovus')

  assert.ok(provider, 'Expected Simnovus provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Simnovus')
  assert.equal(provider.companyCareerPage, 'https://simnovus.com/about-us/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+server-rendered-job-cards+same-page-contact-form-application',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'simnovus.com')
  assert.match(provider.modulePath, /simnovus[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Simnovus'), false)
})

test('Simnovus matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Simnovus,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Simnovus', 'simnovus', 'Simnovus']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'simnovus')

  assert.ok(scraper, 'Expected buildScrapers() to return the Simnovus scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'simnovus')
  assert.equal(scraper.provider.companyCareerPage, 'https://simnovus.com/about-us/careers/')
  assert.match(scraper.dryRunFile, /simnovus[\\/]jobs\.json$/i)
})
