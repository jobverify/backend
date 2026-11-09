import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Telesto Energy is registered against the verified official homepage with no public careers routes', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'telestoenergy')

  assert.ok(provider, 'Expected Telesto Energy provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Telesto Energy')
  assert.equal(provider.companyCareerPage, 'https://www.telestoenergy.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'multi-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'telestoenergy.com')
  assert.match(provider.modulePath, /telestoenergy[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Telesto Energy'), false)
})

test('Telesto Energy matches the backlog directly from provider metadata without adding a company alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Telesto Energy,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Telesto Energy', 'telestoenergy', 'Telesto Energy']],
  )
})

test('Telesto Energy is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'telestoenergy')

  assert.ok(scraper, 'Expected buildScrapers() to return the Telesto Energy scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'telestoenergy')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.telestoenergy.com/')
  assert.match(scraper.dryRunFile, /telestoenergy[\\/]jobs\.json$/i)
})
