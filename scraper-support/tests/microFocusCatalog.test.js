import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Micro Focus is registered against the verified OpenText careers surface', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'microfocus')

  assert.ok(provider, 'Expected Micro Focus provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Micro Focus')
  assert.equal(provider.companyCareerPage, 'https://careers.opentext.com')
  assert.equal(provider.atsPlatform, 'phenom')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(provider.extractionStrategy, 'embedded-json+detail-page')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.opentext.com')
  assert.match(provider.modulePath, /microfocus[\\/]script\.js$/i)
})

test('Micro Focus is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'microfocus')

  assert.ok(scraper, 'Expected buildScrapers() to return the Micro Focus scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'microfocus')
  assert.equal(scraper.provider.companyCareerPage, 'https://careers.opentext.com')
  assert.match(scraper.dryRunFile, /microfocus[\\/]jobs\.json$/i)
})
