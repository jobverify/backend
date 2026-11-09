import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Squareyards as a first-party script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'squareyards')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Squareyards')
  assert.equal(provider.companyCareerPage, 'https://www.squareyards.com/career')
  assert.equal(provider.companyDomain, 'squareyards.com')
  assert.match(provider.modulePath, /squareyards[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Squareyards scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'squareyards')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'squareyards')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /squareyards[\\/]jobs\.json$/i)
})
