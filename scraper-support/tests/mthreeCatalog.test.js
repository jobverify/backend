import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the mthree Greenhouse apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const mthree = catalog.find((provider) => provider.source === 'mthree')

  assert.ok(mthree)
  assert.equal(mthree.adapter, 'apiPortal')
  assert.equal(mthree.atsPlatform, 'greenhouse')
  assert.match(mthree.companyCareerPage, /mthree\.com\/careers/i)
  assert.equal(mthree.companyDomain, 'mthree.com')
  assert.match(mthree.config.discovery.listingApiUrl, /boards-api\.greenhouse\.io\/v1\/boards\/mthree\/jobs/i)
})

test('buildScrapers exposes a runnable mthree apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const mthree = scrapers.find((scraper) => scraper.name === 'mthree')

  assert.ok(mthree)
  assert.equal(typeof mthree.run, 'function')
  assert.match(mthree.dryRunFile, /mthree[\\/]jobs\.json$/)
  assert.equal(mthree.provider.source, 'mthree')
  assert.equal(mthree.provider.atsPlatform, 'greenhouse')
})
