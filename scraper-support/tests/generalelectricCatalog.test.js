import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes General Electric as an exact-name first-party wrapper provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'generalelectric')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'General Electric')
  assert.equal(provider.companyCareerPage, 'https://www.ge.com/faq')
  assert.equal(provider.companyDomain, 'ge.com')
  assert.match(provider.modulePath, /generalelectric[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable General Electric wrapper scraper', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'generalelectric')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.companyName, 'General Electric')
  assert.match(provider.dryRunFile, /generalelectric[\\/]jobs\.json$/i)
})
