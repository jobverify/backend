import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Indian Shades is registered as a verified parked-domain sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indianshades')

  assert.ok(provider, 'Expected Indian Shades provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Indian Shades')
  assert.equal(provider.companyCareerPage, 'http://indianshades.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-route-redirect-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-redirect-shell-plus-parked-lander-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'indianshades.in')
  assert.match(provider.modulePath, /indianshades[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Indian Shades'), false)
})

test('Indian Shades matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'indianshades,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['indianshades', 'indianshades', 'Indian Shades']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'indianshades')

  assert.ok(scraper, 'Expected buildScrapers() to return the Indian Shades scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indianshades')
  assert.equal(scraper.provider.companyCareerPage, 'http://indianshades.in/')
  assert.match(scraper.dryRunFile, /indianshades[\\/]jobs\.json$/i)
})
