import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('OpeninApp is registered against the official homepage with verified missing public careers routes', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'openinapp')

  assert.ok(provider, 'Expected OpeninApp provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'OpeninApp')
  assert.equal(provider.companyCareerPage, 'https://openinapp.com/')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-careers-routes')
  assert.equal(provider.extractionStrategy, 'official-site+404-careers-check')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'openinapp.com')
  assert.match(provider.modulePath, /openinapp[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OpeninApp'), false)
})

test('OpeninApp matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'OpeninApp,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['OpeninApp', 'openinapp'],
  ])
})

test('OpeninApp is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'openinapp')

  assert.ok(scraper, 'Expected buildScrapers() to return the OpeninApp scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'openinapp')
  assert.equal(scraper.provider.companyCareerPage, 'https://openinapp.com/')
  assert.match(scraper.dryRunFile, /openinapp[\\/]jobs\.json$/i)
})
