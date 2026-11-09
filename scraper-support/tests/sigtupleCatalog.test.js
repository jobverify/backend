import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog exposes SigTuple current company authority and an evidence-required Workable runtime', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sigtuple')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workable-public-get')
  assert.equal(provider.companyName, 'SigTuple')
  assert.equal(provider.companyCareerPage, 'https://sigtuple.com/')
  assert.equal(provider.companyDomain, 'sigtuple.com')
  assert.equal(provider.zeroResultPolicy, 'coverage-gap')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.verifiedOn, null)
  assert.match(provider.modulePath, /sigtuple[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Sigtuple scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sigtuple')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sigtuple')
  assert.equal(scraper.provider.atsPlatform, 'workable-public-get')
  assert.match(scraper.dryRunFile, /sigtuple[\\/]jobs\.json$/i)
})
