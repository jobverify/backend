import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Warner Bros. Discovery Phenom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const wbd = catalog.find((provider) => provider.source === 'warnerbrosdiscovery')

  assert.ok(wbd)
  assert.equal(wbd.adapter, 'script')
  assert.equal(wbd.atsPlatform, 'phenom')
  assert.match(wbd.companyCareerPage, /careers\.wbd\.com\/global\/en\/search-results/i)
  assert.equal(wbd.companyDomain, 'careers.wbd.com')
  assert.match(wbd.modulePath, /warnerbrosdiscovery[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Warner Bros. Discovery scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const wbd = scrapers.find((scraper) => scraper.name === 'warnerbrosdiscovery')

  assert.ok(wbd)
  assert.equal(typeof wbd.run, 'function')
  assert.match(wbd.dryRunFile, /warnerbrosdiscovery[\\/]jobs\.json$/)
  assert.equal(wbd.provider.source, 'warnerbrosdiscovery')
  assert.equal(wbd.provider.atsPlatform, 'phenom')
})
