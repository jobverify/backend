import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Zscaler Greenhouse apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const zscaler = catalog.find((provider) => provider.source === 'zscaler')

  assert.ok(zscaler)
  assert.equal(zscaler.adapter, 'apiPortal')
  assert.equal(zscaler.atsPlatform, 'greenhouse')
  assert.match(zscaler.companyCareerPage, /zscaler\.com\/careers\/search/i)
  assert.equal(zscaler.companyDomain, 'zscaler.com')
  assert.match(zscaler.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/zscaler\/jobs/i)
})

test('buildScrapers exposes a runnable Zscaler apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const zscaler = scrapers.find((scraper) => scraper.name === 'zscaler')

  assert.ok(zscaler)
  assert.equal(typeof zscaler.run, 'function')
  assert.match(zscaler.dryRunFile, /zscaler[\\/]jobs\.json$/)
  assert.equal(zscaler.provider.source, 'zscaler')
  assert.equal(zscaler.provider.atsPlatform, 'greenhouse')
})
