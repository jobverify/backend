import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Hike is registered as a verified first-party outage sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hike')

  assert.ok(provider, 'Expected Hike provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hike')
  assert.equal(provider.companyCareerPage, 'https://www.hike.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-outage-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage-502+verified-common-careers-routes-502-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hike.in')
  assert.match(provider.modulePath, /hike[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hike'), false)
})

test('Hike matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Hike,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hike', 'hike', 'Hike']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'hike')

  assert.ok(scraper, 'Expected buildScrapers() to return the Hike scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hike')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.hike.in/')
  assert.match(scraper.dryRunFile, /hike[\\/]jobs\.json$/i)
})
