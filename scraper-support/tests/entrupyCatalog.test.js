import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Entrupy Greenhouse apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const entrupy = catalog.find((provider) => provider.source === 'entrupy')

  assert.ok(entrupy)
  assert.equal(entrupy.adapter, 'apiPortal')
  assert.equal(entrupy.atsPlatform, 'greenhouse')
  assert.match(entrupy.companyCareerPage, /entrupy\.com\/careers\/?$/i)
  assert.equal(entrupy.companyDomain, 'entrupy.com')
  assert.match(entrupy.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/entrupy\/jobs/i)
})

test('buildScrapers exposes a runnable Entrupy apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const entrupy = scrapers.find((scraper) => scraper.name === 'entrupy')

  assert.ok(entrupy)
  assert.equal(typeof entrupy.run, 'function')
  assert.match(entrupy.dryRunFile, /entrupy[\\/]jobs\.json$/)
  assert.equal(entrupy.provider.source, 'entrupy')
  assert.equal(entrupy.provider.atsPlatform, 'greenhouse')
})
