import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Mitsubishi Power India as a script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'mitsubishipowerindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://power.mhi.com/regions/ind/careers')
  assert.equal(provider.companyDomain, 'power.mhi.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /mitsubishipowerindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Mitsubishi Power India scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'mitsubishipowerindia')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://power.mhi.com/regions/ind/careers')
})
