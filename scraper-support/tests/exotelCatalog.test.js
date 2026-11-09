import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Exotel as a Recruiterbox-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'exotel')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'recruiterbox')
  assert.equal(provider.companyName, 'Exotel Techcom Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://exotel.com/about-us/careers/')
  assert.equal(provider.companyDomain, 'exotel.com')
  assert.match(provider.modulePath, /exotel[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Exotel scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'exotel')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'exotel')
  assert.equal(scraper.provider.atsPlatform, 'recruiterbox')
  assert.match(scraper.dryRunFile, /exotel[\\/]jobs\.json$/)
})
