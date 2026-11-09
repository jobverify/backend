import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Ganit as an official careers page Zoho handoff script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ganit')

  assert.ok(provider, 'Expected Ganit provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Ganit')
  assert.equal(provider.companyCareerPage, 'https://www.ganitinc.com/careers')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-official-careers-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+zoho-detail-handoff')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ganitinc.com')
  assert.match(provider.modulePath, /ganit[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Ganit scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ganit')

  assert.ok(scraper, 'Expected buildScrapers() to return the Ganit scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ganit')
  assert.equal(scraper.provider.atsPlatform, 'zoho-recruit')
  assert.match(scraper.dryRunFile, /ganit[\\/]jobs\.json$/i)
})
