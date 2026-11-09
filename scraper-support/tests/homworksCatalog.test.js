import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Homworks as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'homworks')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Homworks')
  assert.equal(provider.companyCareerPage, 'https://www.homworks.com/careers-homworks/')
  assert.equal(provider.companyDomain, 'homworks.com')
  assert.match(provider.modulePath, /homworks[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Homworks scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'homworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'homworks')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /homworks[\\/]jobs\.json$/i)
})
