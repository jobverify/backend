import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Celigo Greenhouse apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const celigo = catalog.find((provider) => provider.source === 'celigo')

  assert.ok(celigo)
  assert.equal(celigo.adapter, 'apiPortal')
  assert.equal(celigo.atsPlatform, 'greenhouse')
  assert.match(celigo.companyCareerPage, /celigo\.com\/careers\/?$/i)
  assert.equal(celigo.companyDomain, 'celigo.com')
  assert.match(celigo.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/celigo\/jobs/i)
})

test('buildScrapers exposes a runnable Celigo apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const celigo = scrapers.find((scraper) => scraper.name === 'celigo')

  assert.ok(celigo)
  assert.equal(typeof celigo.run, 'function')
  assert.match(celigo.dryRunFile, /celigo[\\/]jobs\.json$/)
  assert.equal(celigo.provider.source, 'celigo')
  assert.equal(celigo.provider.atsPlatform, 'greenhouse')
})
