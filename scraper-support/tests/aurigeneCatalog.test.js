import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Aurigene scraper with Zwayam careers metadata', () => {
  const catalog = getScraperCatalog()
  const aurigene = catalog.find((provider) => provider.source === 'aurigene')

  assert.ok(aurigene)
  assert.equal(aurigene.adapter, 'script')
  assert.equal(aurigene.atsPlatform, 'zwayam')
  assert.match(aurigene.companyCareerPage, /careers\.aurigeneservices\.com\/aurigeneservices/i)
  assert.equal(aurigene.companyDomain, 'aurigeneservices.com')
})

test('buildScrapers exposes a runnable Aurigene scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const aurigene = scrapers.find((scraper) => scraper.name === 'aurigene')

  assert.ok(aurigene)
  assert.equal(typeof aurigene.run, 'function')
  assert.match(aurigene.dryRunFile, /aurigene[\\/]jobs\.json$/)
  assert.equal(aurigene.provider.source, 'aurigene')
  assert.equal(aurigene.provider.adapter, 'script')
})
