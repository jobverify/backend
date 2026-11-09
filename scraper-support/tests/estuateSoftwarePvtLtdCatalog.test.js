import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Estuate Software Pvt Ltd as a verified official AWSM careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'estuatesoftwarepvtltd')

  assert.ok(provider, 'Expected Estuate Software Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Estuate Software Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.estuate.com/company/careers')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page-plus-first-party-wp-rest-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-page+official-wordpress-job-openings-rest-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'estuate.com')
  assert.match(provider.modulePath, /estuatesoftwarepvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Estuate Software Pvt Ltd'), false)
})

test('Estuate Software Pvt Ltd is runnable through the provider catalog and matches coverage without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'estuatesoftwarepvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Estuate Software Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'estuatesoftwarepvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.estuate.com/company/careers')
  assert.match(scraper.dryRunFile, /estuatesoftwarepvtltd[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Estuate Software Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Estuate Software Pvt Ltd', 'estuatesoftwarepvtltd', 'Estuate Software Pvt Ltd']],
  )
})
