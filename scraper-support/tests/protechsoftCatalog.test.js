import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Protechsoft is registered as a verified first-party zero-public-careers sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'protechsoft')

  assert.ok(provider, 'Expected Protechsoft provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Protechsoft')
  assert.equal(provider.companyCareerPage, 'https://www.protechsoft.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-page-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+verified-contact-page+verified-missing-careers-shells-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'protechsoft.in')
  assert.match(provider.modulePath, /protechsoft[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Protechsoft'), false)
})

test('Protechsoft matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Protechsoft,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Protechsoft', 'protechsoft', 'Protechsoft']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'protechsoft')

  assert.ok(scraper, 'Expected buildScrapers() to return the Protechsoft sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'protechsoft')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.protechsoft.in/')
  assert.match(scraper.dryRunFile, /protechsoft[\\/]jobs\.json$/i)
})
