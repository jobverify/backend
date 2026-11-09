import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes LTTS on the public India careers page', () => {
  const catalog = getScraperCatalog()
  const ltts = catalog.find((provider) => provider.source === 'ltts')

  assert.ok(ltts)
  assert.equal(ltts.adapter, 'script')
  assert.equal(ltts.atsPlatform, 'sensehq')
  assert.match(ltts.companyCareerPage, /ltts\.com\/careers\/India$/i)
  assert.equal(ltts.companyDomain, 'ltts.com')
  assert.match(ltts.modulePath, /ltts[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable LTTS scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const ltts = scrapers.find((scraper) => scraper.name === 'ltts')

  assert.ok(ltts)
  assert.equal(typeof ltts.run, 'function')
  assert.match(ltts.dryRunFile, /ltts[\\/]jobs\.json$/)
  assert.equal(ltts.provider.source, 'ltts')
  assert.equal(ltts.provider.atsPlatform, 'sensehq')
})
