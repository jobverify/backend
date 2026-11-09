import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Jasmino Corporation is registered against its verified official homepage', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jasminocorporation')

  assert.ok(provider, 'Expected Jasmino Corporation provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Jasmino Corporation')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://jasmino.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-missing-careers-routes')
  assert.equal(provider.extractionStrategy, 'official-site+404-careers-check')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jasmino.com')
  assert.match(provider.modulePath, /jasminocorporation[\\/]script\.js$/i)
})

test('Jasmino Corporation is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jasminocorporation')

  assert.ok(scraper, 'Expected buildScrapers() to return the Jasmino Corporation scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jasminocorporation')
  assert.equal(scraper.provider.companyCareerPage, 'https://jasmino.com/')
  assert.match(scraper.dryRunFile, /jasminocorporation[\\/]jobs\.json$/i)
})
