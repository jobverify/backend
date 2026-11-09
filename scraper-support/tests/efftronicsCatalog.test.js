import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Efftronics scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const efftronics = catalog.find((provider) => provider.source === 'efftronics')

  assert.ok(efftronics)
  assert.equal(efftronics.adapter, 'script')
  assert.equal(efftronics.atsPlatform, 'official-company-careers')
  assert.match(efftronics.companyCareerPage, /efftronics\.com\/careers/i)
  assert.equal(efftronics.companyDomain, 'efftronics.com')
})

test('buildScrapers exposes a runnable Efftronics scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const efftronics = scrapers.find((scraper) => scraper.name === 'efftronics')

  assert.ok(efftronics)
  assert.equal(typeof efftronics.run, 'function')
  assert.match(efftronics.dryRunFile, /efftronics[\\/]jobs\.json$/)
  assert.equal(efftronics.provider.source, 'efftronics')
  assert.equal(efftronics.provider.atsPlatform, 'official-company-careers')
})
