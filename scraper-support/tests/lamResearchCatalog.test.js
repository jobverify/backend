import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Lam Research as an Eightfold apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lamresearch')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.atsPlatform, 'eightfold')
  assert.equal(provider.companyCareerPage, 'https://www.lamresearch.com/careers/careers-overview/')
  assert.equal(provider.companyDomain, 'lamresearch.com')
  assert.match(provider.config.discovery.listingApiUrl, /lamresearch\.eightfold\.ai\/api\/pcsx\/search/i)
  assert.equal(provider.config.request.query.domain, 'lamresearch.com')
})

test('buildScrapers exposes a runnable Lam Research apiPortal scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'lamresearch')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /lamresearch[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'lamresearch')
  assert.equal(scraper.provider.atsPlatform, 'eightfold')
})
