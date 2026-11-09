import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the A. O. Smith official careers scraper with public India metadata', () => {
  const catalog = getScraperCatalog()
  const aosmith = catalog.find((provider) => provider.source === 'aosmith')

  assert.ok(aosmith)
  assert.equal(aosmith.adapter, 'script')
  assert.equal(aosmith.atsPlatform, 'successfactors-public-native-get')
  assert.match(aosmith.companyCareerPage, /jobs\.aosmith\.com\/search/i)
  assert.equal(aosmith.companyDomain, 'aosmith.com')
  assert.match(aosmith.modulePath, /aosmith[\\/]script\.js$/i)
  assert.equal(aosmith.sourceScopeComplete, false)
  assert.equal(aosmith.lifecycleCleanupAllowed, false)
  assert.equal(aosmith.verifiedPublicJobCount, null)
  assert.equal(aosmith.verifiedIndiaJobCount, null)
  assert.equal(aosmith.zeroResultPolicy, 'evidence-required')
  assert.equal(aosmith.runtimeInventoryVerification, true)
  assert.match(aosmith.extractionStrategy, /final-after-details/)
  assert.equal(aosmith.scraperTimeoutMs, 400000)
})

test('buildScrapers exposes a runnable A. O. Smith scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const aosmith = scrapers.find((scraper) => scraper.name === 'aosmith')

  assert.ok(aosmith)
  assert.equal(typeof aosmith.run, 'function')
  assert.match(aosmith.dryRunFile, /aosmith[\\/]jobs\.json$/)
  assert.equal(aosmith.provider.source, 'aosmith')
  assert.equal(aosmith.provider.atsPlatform, 'successfactors-public-native-get')
})
