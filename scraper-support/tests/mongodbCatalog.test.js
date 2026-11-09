import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the MongoDB apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const mongodb = catalog.find((provider) => provider.source === 'mongodb')

  assert.ok(mongodb)
  assert.equal(mongodb.adapter, 'apiPortal')
  assert.equal(mongodb.atsPlatform, 'greenhouse')
  assert.match(mongodb.companyCareerPage, /mongodb\.com\/company\/careers/i)
  assert.equal(mongodb.companyDomain, 'mongodb.com')
  assert.match(mongodb.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/mongodb\/jobs/i)
})

test('buildScrapers exposes a runnable MongoDB apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const mongodb = scrapers.find((scraper) => scraper.name === 'mongodb')

  assert.ok(mongodb)
  assert.equal(typeof mongodb.run, 'function')
  assert.match(mongodb.dryRunFile, /mongodb[\\/]jobs\.json$/)
  assert.equal(mongodb.provider.source, 'mongodb')
  assert.equal(mongodb.provider.atsPlatform, 'greenhouse')
})
