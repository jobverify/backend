import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Eklavya Solution as an official no-public-listings scraper', () => {
  const catalog = getScraperCatalog()
  const eklavya = catalog.find((provider) => provider.source === 'eklavyasolution')

  assert.ok(eklavya)
  assert.equal(eklavya.adapter, 'script')
  assert.equal(eklavya.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(eklavya.companyCareerPage, /eklavyasolution\.com/i)
  assert.equal(eklavya.companyDomain, 'eklavyasolution.com')
})

test('buildScrapers exposes a runnable Eklavya Solution scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const eklavya = scrapers.find((scraper) => scraper.name === 'eklavyasolution')

  assert.ok(eklavya)
  assert.equal(typeof eklavya.run, 'function')
  assert.match(eklavya.dryRunFile, /eklavyasolution[\\/]jobs\.json$/)
  assert.equal(eklavya.provider.source, 'eklavyasolution')
  assert.equal(eklavya.provider.atsPlatform, 'official-company-site-no-public-careers')
})
