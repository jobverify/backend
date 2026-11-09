import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Eaton Eightfold apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const eaton = catalog.find((provider) => provider.source === 'eaton')

  assert.ok(eaton)
  assert.equal(eaton.adapter, 'apiPortal')
  assert.equal(eaton.atsPlatform, 'eightfold')
  assert.match(eaton.companyCareerPage, /jobs\.eaton\.com\/jobs/i)
  assert.equal(eaton.companyDomain, 'jobs.eaton.com')
  assert.match(eaton.config.discovery.listingApiUrl, /eaton\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.deepEqual(eaton.config.mapping.location, {strategy:'eightfold-location'})
  assert.deepEqual(eaton.config.mapping.country, {strategy:'eightfold-country'})
})

test('buildScrapers exposes a runnable Eaton apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const eaton = scrapers.find((scraper) => scraper.name === 'eaton')

  assert.ok(eaton)
  assert.equal(typeof eaton.run, 'function')
  assert.match(eaton.dryRunFile, /eaton[\\/]jobs\.json$/)
  assert.equal(eaton.provider.source, 'eaton')
  assert.equal(eaton.provider.atsPlatform, 'eightfold')
})
