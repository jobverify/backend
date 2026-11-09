import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes John Deere India as an Eightfold api-portal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'johndeereindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyName, 'John Deere India')
  assert.equal(provider.companyCareerPage, 'https://careers.deere.com/careers?location=India')
  assert.equal(provider.companyDomain, 'careers.deere.com')
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.config.discovery.listingApiUrl, 'https://careers.deere.com/api/pcsx/search')
})

test('buildScrapers exposes a runnable John Deere India api-portal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'johndeereindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'apiPortal')
  assert.equal(scraper.provider.parser, 'api-portal')
  assert.match(scraper.dryRunFile, /johndeereindia[\\/]jobs\.json$/)
})
