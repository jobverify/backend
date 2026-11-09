import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test("getScraperCatalog includes the Lowe's India Phenom script provider with official metadata", () => {
  const catalog = getScraperCatalog()
  const lowes = catalog.find((provider) => provider.source === 'lowesindia')

  assert.ok(lowes)
  assert.equal(lowes.adapter, 'script')
  assert.equal(lowes.atsPlatform, 'phenom')
  assert.match(lowes.companyCareerPage, /talent\.lowes\.com\/in\/en\/search-results/i)
  assert.equal(lowes.companyDomain, 'talent.lowes.com')
  assert.match(lowes.modulePath, /lowesindia[\\/]script\.js$/i)
})

test("buildScrapers exposes a runnable Lowe's India scraper without changing the runner contract", () => {
  const scrapers = buildScrapers()
  const lowes = scrapers.find((scraper) => scraper.name === 'lowesindia')

  assert.ok(lowes)
  assert.equal(typeof lowes.run, 'function')
  assert.match(lowes.dryRunFile, /lowesindia[\\/]jobs\.json$/)
  assert.equal(lowes.provider.source, 'lowesindia')
  assert.equal(lowes.provider.atsPlatform, 'phenom')
})
