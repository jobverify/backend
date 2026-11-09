import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CFI as a verified BambooHR empty-state sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cfi')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CFI')
  assert.equal(provider.companyCareerPage, 'https://corporatefinanceinstitute.com/about-cfi/careers-at-cfi/')
  assert.equal(provider.atsPlatform, 'bamboohr')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-bamboohr-embed-empty-sentinel')
  assert.equal(provider.extractionStrategy, 'official-careers-page+bamboohr-empty-embed')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'corporatefinanceinstitute.com')
  assert.match(provider.modulePath, /cfi[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CFI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cfi')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cfi')
  assert.equal(scraper.provider.adapter, 'script')
  assert.match(scraper.dryRunFile, /cfi[\\/]jobs\.json$/i)
})
