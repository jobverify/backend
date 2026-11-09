import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Apple official careers script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const apple = catalog.find((provider) => provider.source === 'apple')

  assert.ok(apple)
  assert.equal(apple.adapter, 'script')
  assert.equal(apple.atsPlatform, 'official-company-careers')
  assert.match(apple.companyCareerPage, /jobs\.apple\.com/i)
  assert.equal(apple.companyDomain, 'jobs.apple.com')
})

test('buildScrapers exposes a runnable Apple scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const apple = scrapers.find((scraper) => scraper.name === 'apple')

  assert.ok(apple)
  assert.equal(typeof apple.run, 'function')
  assert.match(apple.dryRunFile, /apple[\\/]jobs\.json$/)
  assert.equal(apple.provider.source, 'apple')
  assert.equal(apple.provider.atsPlatform, 'official-company-careers')
})
