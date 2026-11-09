import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Eightfold AI apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const eightfold = catalog.find((provider) => provider.source === 'eightfoldai')

  assert.ok(eightfold)
  assert.equal(eightfold.adapter, 'apiPortal')
  assert.equal(eightfold.atsPlatform, 'eightfold')
  assert.match(eightfold.companyCareerPage, /eightfold\.ai\/company\/careers/i)
  assert.equal(eightfold.companyDomain, 'eightfold.ai')
  assert.match(eightfold.config.discovery.listingApiUrl, /app\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.equal(eightfold.config.request.query.domain, 'volkscience.com')
})

test('buildScrapers exposes a runnable Eightfold AI apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const eightfold = scrapers.find((scraper) => scraper.name === 'eightfoldai')

  assert.ok(eightfold)
  assert.equal(typeof eightfold.run, 'function')
  assert.match(eightfold.dryRunFile, /eightfoldai[\\/]jobs\.json$/)
  assert.equal(eightfold.provider.source, 'eightfoldai')
  assert.equal(eightfold.provider.atsPlatform, 'eightfold')
})
