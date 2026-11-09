import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Clarisights as a verified Teamtailor-backed first-party careers source', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'clarisights')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Clarisights')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'teamtailor')
  assert.equal(provider.companyCareerPage, 'https://clarisights.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'count-checked-public-teamtailor-pages')
  assert.equal(provider.extractionStrategy, 'official-careers-widget+public-teamtailor-api+included-location-country-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'clarisights.com')
  assert.match(provider.modulePath, /clarisights[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Clarisights scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'clarisights')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'clarisights')
  assert.match(scraper.dryRunFile, /clarisights[\\/]jobs\.json$/i)
})
