import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Ribbon Communications is registered with the verified first-party Workday surface and exact CSV alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ribboncommunication')

  assert.ok(provider, 'Expected Ribbon Communication provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ribbon Communications')
  assert.equal(provider.companyCareerPage, 'https://ribboncommunications.com/company/careers')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-workday-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page-validation+verified-workday-handoff+workday-jobs-api+detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ribboncommunications.com')
  assert.match(provider.modulePath, /ribboncommunication\.workday[\\/]script\.js$/i)
  assert.equal(companyAliases['Ribbon Communication'], 'ribboncommunication')
})

test('Ribbon Communication matches company coverage through the explicit exact CSV alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ribbon Communication,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ribbon Communication', 'ribboncommunication', 'Ribbon Communications']],
  )
})

test('Ribbon Communication is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ribboncommunication')

  assert.ok(scraper, 'Expected buildScrapers() to return the Ribbon Communication scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ribboncommunication')
  assert.equal(scraper.provider.companyCareerPage, 'https://ribboncommunications.com/company/careers')
  assert.match(scraper.dryRunFile, /ribboncommunication\.workday[\\/]jobs\.json$/i)
})
