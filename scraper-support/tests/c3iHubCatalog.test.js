import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes C3iHub as a verified first-party Keka-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'c3ihub')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'C3iHub')
  assert.equal(provider.companyCareerPage, 'https://c3ihub.org/careers')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(provider.extractionStrategy, 'official-homepage+careers-page-bundle+active-keka-embed-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'c3ihub.org')
  assert.match(provider.modulePath, /c3ihub[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'C3iHub'), false)
})

test('buildScrapers exposes a runnable C3iHub scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'c3ihub')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'c3ihub')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.atsPlatform, 'keka-embed-api')
  assert.match(scraper.dryRunFile, /c3ihub[\\/]jobs\.json$/i)
})
