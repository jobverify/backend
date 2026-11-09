import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Lakshmi Group of Companies is registered as a verified first-party zero-job scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lakshmigroupofcompanies')

  assert.ok(provider, 'Expected Lakshmi Group of Companies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Lakshmi Group of Companies')
  assert.equal(provider.companyCareerPage, 'http://www.lakshmigroup.co.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lakshmigroup.co.in')
  assert.match(provider.modulePath, /lakshmigroupofcompanies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Lakshmi Group of Companies'), false)
})

test('Lakshmi Group of Companies matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Lakshmi Group of Companies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lakshmi Group of Companies', 'lakshmigroupofcompanies', 'Lakshmi Group of Companies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'lakshmigroupofcompanies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Lakshmi Group of Companies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lakshmigroupofcompanies')
  assert.equal(scraper.provider.companyCareerPage, 'http://www.lakshmigroup.co.in/')
  assert.match(scraper.dryRunFile, /lakshmigroupofcompanies[\\/]jobs\.json$/i)
})
