import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog selects the current first-party Thoughtworks script with official metadata', () => {
  const catalog = getScraperCatalog()
  const thoughtworks = catalog.find((provider) => provider.source === 'thoughtworks')

  assert.ok(thoughtworks)
  assert.equal(thoughtworks.adapter, 'script')
  assert.equal(thoughtworks.atsPlatform, 'first-party-careers')
  assert.match(thoughtworks.companyCareerPage, /thoughtworks\.com\/careers\/jobs/i)
  assert.equal(thoughtworks.companyDomain, 'thoughtworks.com')
  assert.match(thoughtworks.modulePath, /thoughtworks[\\/]script\.js$/)
  assert.equal(thoughtworks.config, null)
  assert.equal(thoughtworks.sourceScopeComplete, false)
  assert.equal(thoughtworks.lifecycleCleanupAllowed, false)
  assert.equal(thoughtworks.verifiedPublicJobCount, null)
  assert.equal(thoughtworks.verifiedIndiaJobCount, null)
})

test('buildScrapers exposes the current Thoughtworks script through the existing runner contract', () => {
  const scrapers = buildScrapers()
  const thoughtworks = scrapers.find((scraper) => scraper.name === 'thoughtworks')

  assert.ok(thoughtworks)
  assert.equal(typeof thoughtworks.run, 'function')
  assert.match(thoughtworks.dryRunFile, /thoughtworks[\\/]jobs\.json$/)
  assert.equal(thoughtworks.provider.source, 'thoughtworks')
  assert.equal(thoughtworks.provider.adapter, 'script')
  assert.equal(thoughtworks.provider.atsPlatform, 'first-party-careers')
  assert.equal(thoughtworks.provider.lifecycleCleanupAllowed, false)
})
