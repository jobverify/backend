import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CodeTantra as an official-site no-listings script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'codetantra')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://codetantra.com/')
  assert.equal(provider.companyDomain, 'codetantra.com')
  assert.match(provider.modulePath, /codetantra[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CodeTantra scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'codetantra')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-site')
  assert.match(provider.dryRunFile, /codetantra[\\/]jobs\.json$/)
})
