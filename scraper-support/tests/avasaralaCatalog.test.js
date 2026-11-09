import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Avasarala Technologies scraper with official careers metadata', () => {
  const catalog = getScraperCatalog()
  const avasarala = catalog.find((provider) => provider.source === 'avasarala')

  assert.ok(avasarala)
  assert.equal(avasarala.adapter, 'script')
  assert.equal(avasarala.atsPlatform, 'official-company-careers')
  assert.match(avasarala.companyCareerPage, /avasarala\.com\/careers\.html/i)
  assert.equal(avasarala.companyDomain, 'avasarala.com')
})

test('buildScrapers exposes a runnable Avasarala Technologies scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const avasarala = scrapers.find((scraper) => scraper.name === 'avasarala')

  assert.ok(avasarala)
  assert.equal(typeof avasarala.run, 'function')
  assert.match(avasarala.dryRunFile, /avasarala[\\/]jobs\.json$/)
  assert.equal(avasarala.provider.source, 'avasarala')
  assert.equal(avasarala.provider.adapter, 'script')
})
