import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bluestock Fintech with its official careers metadata', () => {
  const catalog = getScraperCatalog()
  const bluestock = catalog.find((provider) => provider.source === 'bluestock')

  assert.ok(bluestock)
  assert.equal(bluestock.adapter, 'script')
  assert.equal(bluestock.atsPlatform, 'custom-careers-pages')
  assert.match(bluestock.companyCareerPage, /bluestock\.in\/careers/i)
  assert.equal(bluestock.companyDomain, 'bluestock.in')
})

test('buildScrapers exposes a runnable Bluestock scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bluestock = scrapers.find((scraper) => scraper.name === 'bluestock')

  assert.ok(bluestock)
  assert.equal(typeof bluestock.run, 'function')
  assert.match(bluestock.dryRunFile, /bluestock[\\/]jobs\.json$/)
  assert.equal(bluestock.provider.source, 'bluestock')
  assert.equal(bluestock.provider.adapter, 'script')
})
