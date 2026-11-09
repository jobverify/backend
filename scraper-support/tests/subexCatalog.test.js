import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Subex as a Darwinbox script provider with verified official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'subex')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'Subex')
  assert.equal(provider.companyCareerPage, 'https://www.subex.com/careers/')
  assert.equal(provider.companyDomain, 'subex.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /subex[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Subex script scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'subex')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'subex')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /subex[\\/]jobs\.json$/i)
})
