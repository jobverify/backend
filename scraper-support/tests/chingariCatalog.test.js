import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Chingari as an official WordPress careers-feed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'chingari')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Chingari')
  assert.equal(provider.companyCareerPage, 'https://careers.chingari.io/career/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'wp-rest-posts')
  assert.equal(provider.extractionStrategy, 'wordpress-posts-api+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.chingari.io')
  assert.match(provider.modulePath, /chingari[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Chingari scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'chingari')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'chingari')
  assert.equal(scraper.provider.adapter, 'script')
  assert.match(scraper.dryRunFile, /chingari[\\/]jobs\.json$/i)
})
