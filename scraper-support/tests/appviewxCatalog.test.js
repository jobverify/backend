import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the AppViewX Greenhouse apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const appviewx = catalog.find((provider) => provider.source === 'appviewx')

  assert.ok(appviewx)
  assert.equal(appviewx.adapter, 'apiPortal')
  assert.equal(appviewx.atsPlatform, 'greenhouse')
  assert.match(appviewx.companyCareerPage, /appviewx\.com\/company\/careers/i)
  assert.equal(appviewx.companyDomain, 'appviewx.com')
  assert.match(appviewx.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/appviewx\/jobs/i)
})

test('buildScrapers exposes a runnable AppViewX apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const appviewx = scrapers.find((scraper) => scraper.name === 'appviewx')

  assert.ok(appviewx)
  assert.equal(typeof appviewx.run, 'function')
  assert.match(appviewx.dryRunFile, /appviewx[\\/]jobs\.json$/)
  assert.equal(appviewx.provider.source, 'appviewx')
  assert.equal(appviewx.provider.atsPlatform, 'greenhouse')
})
