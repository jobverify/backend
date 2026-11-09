import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Chronus as a Recruiterbox-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'chronus')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'recruiterbox')
  assert.equal(provider.companyName, 'Chronus')
  assert.equal(provider.companyCareerPage, 'https://chronus.com/about-us/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-json-feed')
  assert.equal(provider.extractionStrategy, 'verified-official-careers-page+recruiterbox-openings-json')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'chronus.com')
  assert.match(provider.modulePath, /chronus[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Chronus scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'chronus')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'chronus')
  assert.equal(scraper.provider.atsPlatform, 'recruiterbox')
  assert.match(scraper.dryRunFile, /chronus[\\/]jobs\.json$/i)
})
