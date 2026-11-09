import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ELEATION as an official application-only careers scraper', () => {
  const catalog = getScraperCatalog()
  const eleation = catalog.find((provider) => provider.source === 'eleation')

  assert.ok(eleation)
  assert.equal(eleation.adapter, 'script')
  assert.equal(eleation.atsPlatform, 'official-company-careers')
  assert.match(eleation.companyCareerPage, /eleation\.com\/career\//i)
  assert.equal(eleation.companyDomain, 'eleation.com')
})

test('buildScrapers exposes a runnable ELEATION scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const eleation = scrapers.find((scraper) => scraper.name === 'eleation')

  assert.ok(eleation)
  assert.equal(typeof eleation.run, 'function')
  assert.match(eleation.dryRunFile, /eleation[\\/]jobs\.json$/)
  assert.equal(eleation.provider.source, 'eleation')
  assert.equal(eleation.provider.atsPlatform, 'official-company-careers')
})
