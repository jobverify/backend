import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog routes Worley through source-local criteria qualification with the original Eightfold API configuration', () => {
  const catalog = getScraperCatalog()
  const worley = catalog.find((provider) => provider.source === 'worley')

  assert.ok(worley)
  assert.equal(worley.adapter, 'script')
  assert.match(worley.modulePath, /scraper[\\/]worley[\\/]script\.js$/)
  assert.equal(worley.sourceScopeComplete, false)
  assert.equal(worley.lifecycleCleanupAllowed, false)
  assert.equal(worley.atsPlatform, 'eightfold')
  assert.match(worley.companyCareerPage, /worley\.com\/en\/careers/i)
  assert.equal(worley.companyDomain, 'worley.com')
  assert.match(worley.config.discovery.listingApiUrl, /jobs\.worley\.com\/api\/pcsx\/search/i)
  assert.equal(worley.config.request.query.domain, 'worley.com')
  assert.deepEqual(worley.config.mapping.location, {strategy:'eightfold-location'})
  assert.deepEqual(worley.config.mapping.country, {strategy:'eightfold-country'})
  assert.equal(worley.config.detail.requireListingIdentity, true)
  assert.equal(worley.config.detail.concurrency, 1)
  assert.equal(worley.publicAccessPolicy, 'preserve-verified-stop-denied-origin')
  assert.deepEqual(worley.config.rateLimit, {minimumIntervalMs:1000, maxRetries:1,
    baseDelayMs:5000, maxDelayMs:30000})
})

test('buildScrapers exposes the runnable Worley criteria wrapper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const worley = scrapers.find((scraper) => scraper.name === 'worley')

  assert.ok(worley)
  assert.equal(typeof worley.run, 'function')
  assert.match(worley.dryRunFile, /worley[\\/]jobs\.json$/)
  assert.equal(worley.provider.source, 'worley')
  assert.equal(worley.provider.atsPlatform, 'eightfold')
})
