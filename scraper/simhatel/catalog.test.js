import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Simhatel Technology Private Limited is registered as a verified first-party no-public-careers sentinel with short-name alias coverage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'simhatel')

  assert.ok(provider, 'Expected Simhatel provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Simhatel Technology Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.simhatel.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-site-and-no-public-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-marketing-surface-and-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'simhatel.com')
  assert.match(provider.modulePath, /simhatel[\\/]script\.js$/i)
  assert.equal(companyAliases.Simhatel, 'simhatel')
})

test('Simhatel matches company coverage through the short-name alias and provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Simhatel,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Simhatel', 'simhatel', 'Simhatel Technology Private Limited']],
  )
})

test('Simhatel is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'simhatel')

  assert.ok(scraper, 'Expected buildScrapers() to return the Simhatel sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'simhatel')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.simhatel.com/')
  assert.match(scraper.dryRunFile, /simhatel[\\/]jobs\.json$/i)
})
