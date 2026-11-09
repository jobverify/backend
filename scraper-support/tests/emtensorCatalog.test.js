import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes EMTensor as an official first-party careers scraper', () => {
  const catalog = getScraperCatalog()
  const emtensor = catalog.find((provider) => provider.source === 'emtensor')

  assert.ok(emtensor)
  assert.equal(emtensor.adapter, 'script')
  assert.equal(emtensor.atsPlatform, 'official-company-careers')
  assert.match(emtensor.companyCareerPage, /emtensor\.com\/about-us\/recruitment/i)
  assert.equal(emtensor.companyDomain, 'emtensor.com')
})

test('buildScrapers exposes a runnable EMTensor scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const emtensor = scrapers.find((scraper) => scraper.name === 'emtensor')

  assert.ok(emtensor)
  assert.equal(typeof emtensor.run, 'function')
  assert.match(emtensor.dryRunFile, /emtensor[\\/]jobs\.json$/)
  assert.equal(emtensor.provider.source, 'emtensor')
  assert.equal(emtensor.provider.atsPlatform, 'official-company-careers')
})
