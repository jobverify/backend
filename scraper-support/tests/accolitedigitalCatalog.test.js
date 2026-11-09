import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog keeps historical Accolite as a canonical Bounteous delegation', () => {
  const catalog = getScraperCatalog()
  const accolite = catalog.find((provider) => provider.source === 'accolitedigital')

  assert.ok(accolite)
  assert.equal(accolite.adapter, 'script')
  assert.equal(accolite.atsPlatform, 'bounteous-canonical-delegation')
  assert.equal(accolite.canonicalSource, 'bounteous')
  assert.equal(accolite.aliasOfSource, 'bounteous')
  assert.deepEqual(accolite.inventoryDelegation.sources, ['bounteous'])
  assert.match(accolite.companyCareerPage, /bounteous\.com\/careers\/search-results/i)
  assert.equal(accolite.companyDomain, 'bounteous.com')
  assert.match(accolite.modulePath, /accolitedigital[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Accolite Digital scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const accolite = scrapers.find((scraper) => scraper.name === 'accolitedigital')

  assert.ok(accolite)
  assert.equal(typeof accolite.run, 'function')
  assert.match(accolite.dryRunFile, /accolitedigital[\\/]jobs\.json$/)
  assert.equal(accolite.provider.source, 'accolitedigital')
  assert.equal(accolite.provider.atsPlatform, 'bounteous-canonical-delegation')
})
