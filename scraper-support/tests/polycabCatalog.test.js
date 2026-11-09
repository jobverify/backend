import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Polycab as a Darwinbox script provider with verified official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'polycab')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'Polycab')
  assert.equal(provider.companyCareerPage, 'https://polycab.com/life-at-polycab/careers')
  assert.equal(provider.companyDomain, 'polycab.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /polycab[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Polycab script scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'polycab')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'polycab')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /polycab[\\/]jobs\.json$/i)
})
