import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('m2nxt Solutions (P) Ltd is registered in the custom provider catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'm2nxt')

  assert.ok(provider, 'Expected m2nxt Solutions (P) Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'm2nxt Solutions (P) Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.m2nxt.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-job-openings+shared-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'm2nxt.com')
  assert.match(provider.modulePath, /m2nxt[\\/]script\.js$/i)
})

test('m2nxt Solutions (P) Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'm2nxt')

  assert.ok(scraper, 'Expected buildScrapers() to return the m2nxt scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'm2nxt')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.m2nxt.com/careers')
  assert.match(scraper.dryRunFile, /m2nxt[\\/]jobs\.json$/i)
})
