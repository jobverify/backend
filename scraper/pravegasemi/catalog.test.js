import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('PravegaSemi Private Limited is registered against the verified first-party careers form without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pravegasemi')

  assert.ok(provider, 'Expected PravegaSemi provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PravegaSemi Private Limited')
  assert.equal(provider.companyCareerPage, 'https://pravegasemi.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'resume-form-no-openings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pravegasemi.com')
  assert.match(provider.modulePath, /pravegasemi[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PravegaSemi Pvt Ltd'), false)
})

test('PravegaSemi Pvt Ltd CSV row matches the official provider metadata directly', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PravegaSemi Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PravegaSemi Pvt Ltd', 'pravegasemi', 'PravegaSemi Private Limited']],
  )
})

test('PravegaSemi is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'pravegasemi')

  assert.ok(scraper, 'Expected buildScrapers() to return the PravegaSemi scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pravegasemi')
  assert.equal(scraper.provider.companyCareerPage, 'https://pravegasemi.com/careers/')
  assert.match(scraper.dryRunFile, /pravegasemi[\\/]jobs\.json$/i)
})
