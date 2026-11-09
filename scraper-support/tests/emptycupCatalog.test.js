import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Empty Cup as an official no-public-careers scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'emptycup')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://emptycup.in/')
  assert.equal(provider.companyDomain, 'emptycup.in')
  assert.match(provider.modulePath, /emptycup[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Empty Cup scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'emptycup')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.dryRunFile, /emptycup[\\/]jobs\.json$/)
})
