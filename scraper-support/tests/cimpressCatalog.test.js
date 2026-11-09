import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cimpress as a RippleHire script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const cimpress = catalog.find((provider) => provider.source === 'cimpress')

  assert.ok(cimpress)
  assert.equal(cimpress.adapter, 'script')
  assert.equal(cimpress.atsPlatform, 'ripplehire')
  assert.match(cimpress.companyCareerPage, /cimpress\.ripplehire\.com\/candidate/i)
  assert.equal(cimpress.companyDomain, 'cimpress.ripplehire.com')
  assert.match(cimpress.modulePath, /cimpress[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Cimpress RippleHire scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cimpress = scrapers.find((scraper) => scraper.name === 'cimpress')

  assert.ok(cimpress)
  assert.equal(typeof cimpress.run, 'function')
  assert.match(cimpress.dryRunFile, /cimpress[\\/]jobs\.json$/)
  assert.equal(cimpress.provider.source, 'cimpress')
  assert.equal(cimpress.provider.atsPlatform, 'ripplehire')
})
