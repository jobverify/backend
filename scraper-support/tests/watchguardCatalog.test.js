import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog registers the WatchGuard native publication reader with unresolved source scope', () => {
  const catalog = getScraperCatalog()
  const watchguard = catalog.find((provider) => provider.source === 'watchguard')

  assert.ok(watchguard)
  assert.equal(watchguard.adapter, 'script')
  assert.equal(watchguard.atsPlatform, 'lever')
  assert.equal(watchguard.companyName, 'WatchGuard Technologies')
  assert.match(watchguard.companyCareerPage, /watchguard\.com\/wgrd-careers\/?$/i)
  assert.equal(watchguard.companyDomain, 'watchguard.com')
  assert.match(watchguard.modulePath, /scraper[\\/]watchguard[\\/]script\.js$/)
  assert.equal(watchguard.sourceScopeComplete, false)
  assert.equal(watchguard.lifecycleCleanupAllowed, false)
  assert.equal(watchguard.zeroResultPolicy, 'evidence-required')
  assert.match(watchguard.config.discovery.listingApiUrl, /api\.lever\.co\/v0\/postings\/watchguard/i)
})

test('buildScrapers exposes the WatchGuard source reader through the existing runner contract', () => {
  const scrapers = buildScrapers()
  const watchguard = scrapers.find((scraper) => scraper.name === 'watchguard')

  assert.ok(watchguard)
  assert.equal(typeof watchguard.run, 'function')
  assert.match(watchguard.dryRunFile, /watchguard[\\/]jobs\.json$/)
  assert.equal(watchguard.provider.source, 'watchguard')
  assert.equal(watchguard.provider.atsPlatform, 'lever')
})
