import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Signify Innovation Labs Phenom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const signify = catalog.find((provider) => provider.source === 'signifyinnovationlabs')

  assert.ok(signify)
  assert.equal(signify.adapter, 'script')
  assert.equal(signify.atsPlatform, 'phenom')
  assert.match(signify.companyCareerPage, /careers\.signify\.com\/global\/en\/search-results/i)
  assert.equal(signify.companyDomain, 'careers.signify.com')
  assert.match(signify.modulePath, /signifyinnovationlabs[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Signify Innovation Labs scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const signify = scrapers.find((scraper) => scraper.name === 'signifyinnovationlabs')

  assert.ok(signify)
  assert.equal(typeof signify.run, 'function')
  assert.match(signify.dryRunFile, /signifyinnovationlabs[\\/]jobs\.json$/)
  assert.equal(signify.provider.source, 'signifyinnovationlabs')
  assert.equal(signify.provider.atsPlatform, 'phenom')
})
