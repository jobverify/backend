import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Edutinker as an official first-party careers scraper', () => {
  const catalog = getScraperCatalog()
  const edutinker = catalog.find((provider) => provider.source === 'edutinker')

  assert.ok(edutinker)
  assert.equal(edutinker.adapter, 'script')
  assert.equal(edutinker.atsPlatform, 'official-company-careers')
  assert.match(edutinker.companyCareerPage, /edutinker\.com\/careers-at-edutinker/i)
  assert.equal(edutinker.companyDomain, 'edutinker.com')
})

test('buildScrapers exposes a runnable Edutinker scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const edutinker = scrapers.find((scraper) => scraper.name === 'edutinker')

  assert.ok(edutinker)
  assert.equal(typeof edutinker.run, 'function')
  assert.match(edutinker.dryRunFile, /edutinker[\\/]jobs\.json$/)
  assert.equal(edutinker.provider.source, 'edutinker')
  assert.equal(edutinker.provider.atsPlatform, 'official-company-careers')
})
