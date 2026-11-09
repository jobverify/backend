import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the ACKO Kula-backed script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const acko = catalog.find((provider) => provider.source === 'acko')

  assert.ok(acko)
  assert.equal(acko.adapter, 'script')
  assert.equal(acko.atsPlatform, 'kula-public-api')
  assert.match(acko.companyCareerPage, /acko\.com\/careers\/jobs/i)
  assert.equal(acko.companyDomain, 'acko.com')
  assert.equal(acko.parser, 'validated-kula-public-api')
  assert.match(acko.modulePath, /acko[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ACKO scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const acko = scrapers.find((scraper) => scraper.name === 'acko')

  assert.ok(acko)
  assert.equal(typeof acko.run, 'function')
  assert.match(acko.dryRunFile, /acko[\\/]jobs\.json$/)
  assert.equal(acko.provider.source, 'acko')
  assert.equal(acko.provider.atsPlatform, 'kula-public-api')
})
