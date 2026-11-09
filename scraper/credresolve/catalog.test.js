import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CredResolve is registered against its verified first-party WP Job Openings careers archive without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'credresolve')

  assert.ok(provider, 'Expected CredResolve provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CredResolve')
  assert.equal(provider.companyCareerPage, 'https://credresolve.co.in/jobopenings')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'wp-json-page-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-job-openings-page+awsm-rest-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'credresolve.co.in')
  assert.match(provider.modulePath, /credresolve[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'CredResolve'), false)
})

test('CredResolve matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'CredResolve,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CredResolve', 'credresolve', 'CredResolve']],
  )
})

test('CredResolve is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'credresolve')

  assert.ok(scraper, 'Expected buildScrapers() to return the CredResolve scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'credresolve')
  assert.equal(scraper.provider.companyCareerPage, 'https://credresolve.co.in/jobopenings')
  assert.match(scraper.dryRunFile, /credresolve[\\/]jobs\.json$/i)
})
