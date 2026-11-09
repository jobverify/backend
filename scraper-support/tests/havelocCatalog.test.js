import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Haveloc is registered as a verified no-public-careers sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'haveloc')

  assert.ok(provider, 'Expected Haveloc provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Haveloc')
  assert.equal(provider.companyCareerPage, 'https://haveloc.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-missing-first-party-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'haveloc.com')
  assert.match(provider.modulePath, /haveloc[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Haveloc'), false)
})

test('Haveloc matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Haveloc,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Haveloc', 'haveloc', 'Haveloc']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'haveloc')

  assert.ok(scraper, 'Expected buildScrapers() to return the Haveloc scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'haveloc')
  assert.equal(scraper.provider.companyCareerPage, 'https://haveloc.com/')
  assert.match(scraper.dryRunFile, /haveloc[\\/]jobs\.json$/i)
})
