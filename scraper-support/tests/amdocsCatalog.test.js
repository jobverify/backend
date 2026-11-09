import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Amdocs Eightfold apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const amdocs = catalog.find((provider) => provider.source === 'amdocs')

  assert.ok(amdocs)
  assert.equal(amdocs.adapter, 'apiPortal')
  assert.equal(amdocs.atsPlatform, 'eightfold')
  assert.match(amdocs.companyCareerPage, /jobs\.amdocs\.com\/careers/i)
  assert.equal(amdocs.companyDomain, 'jobs.amdocs.com')
  assert.match(amdocs.config.discovery.listingApiUrl, /jobs\.amdocs\.com\/api\/pcsx\/search/i)
})

test('buildScrapers exposes a runnable Amdocs apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const amdocs = scrapers.find((scraper) => scraper.name === 'amdocs')

  assert.ok(amdocs)
  assert.equal(typeof amdocs.run, 'function')
  assert.match(amdocs.dryRunFile, /amdocs[\\/]jobs\.json$/)
  assert.equal(amdocs.provider.source, 'amdocs')
  assert.equal(amdocs.provider.atsPlatform, 'eightfold')
})
