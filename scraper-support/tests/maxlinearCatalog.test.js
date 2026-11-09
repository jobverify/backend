import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes MaxLinear as an official iCIMS script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'maxlinear')

  assert.ok(provider)
  assert.equal(provider.companyName, 'MaxLinear')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'icims')
  assert.equal(provider.companyCareerPage, 'https://www.maxlinear.com/company/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-query')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+icims-job-cards+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'maxlinear.com')
  assert.match(provider.modulePath, /maxlinear[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable MaxLinear scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'maxlinear')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /maxlinear[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'maxlinear')
  assert.equal(scraper.provider.atsPlatform, 'icims')
})
