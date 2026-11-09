import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Worley Eightfold apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const worley = catalog.find((provider) => provider.source === 'worley')

  assert.ok(worley)
  assert.equal(worley.adapter, 'apiPortal')
  assert.equal(worley.atsPlatform, 'eightfold')
  assert.match(worley.companyCareerPage, /worley\.com\/en\/careers/i)
  assert.equal(worley.companyDomain, 'worley.com')
  assert.match(worley.config.discovery.listingApiUrl, /jobs\.worley\.com\/api\/pcsx\/search/i)
  assert.equal(worley.config.request.query.domain, 'worley.com')
  assert.deepEqual(worley.config.mapping.location, {strategy:'eightfold-location'})
  assert.deepEqual(worley.config.mapping.country, {strategy:'eightfold-country'})
})

test('buildScrapers exposes a runnable Worley apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const worley = scrapers.find((scraper) => scraper.name === 'worley')

  assert.ok(worley)
  assert.equal(typeof worley.run, 'function')
  assert.match(worley.dryRunFile, /worley[\\/]jobs\.json$/)
  assert.equal(worley.provider.source, 'worley')
  assert.equal(worley.provider.atsPlatform, 'eightfold')
})
