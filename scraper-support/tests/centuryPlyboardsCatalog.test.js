import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Century Plyboards as an X0PA-backed scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'centuryplyboards')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Century Plyboards')
  assert.equal(provider.companyCareerPage, 'https://www.centuryply.com/careers')
  assert.equal(provider.atsPlatform, 'x0pa')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'listing-api+detail-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'centuryply.com')
  assert.match(provider.modulePath, /centuryplyboards[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Century Plyboards scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'centuryplyboards')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'centuryplyboards')
  assert.equal(scraper.provider.adapter, 'script')
  assert.match(scraper.dryRunFile, /centuryplyboards[\\/]jobs\.json$/i)
})
