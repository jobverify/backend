import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes HiveMinds as a verified first-party Keka-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hiveminds')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HiveMinds')
  assert.equal(provider.companyCareerPage, 'https://www.hiveminds.in/careers')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(provider.extractionStrategy, 'official-homepage+careers-page-bundle+active-keka-embed-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hiveminds.in')
  assert.match(provider.modulePath, /hiveminds[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'HiveMinds'), false)
})

test('buildScrapers exposes a runnable HiveMinds scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hiveminds')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hiveminds')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.atsPlatform, 'keka-embed-api')
  assert.match(scraper.dryRunFile, /hiveminds[\\/]jobs\.json$/i)
})
