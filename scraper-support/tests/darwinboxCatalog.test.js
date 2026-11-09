import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Darwinbox script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const darwinbox = catalog.find((provider) => provider.source === 'darwinbox')

  assert.ok(darwinbox)
  assert.equal(darwinbox.adapter, 'script')
  assert.equal(darwinbox.atsPlatform, 'darwinbox')
  assert.equal(darwinbox.companyCareerPage, 'https://darwinbox.com/en-us/careers')
  assert.equal(darwinbox.companyDomain, 'darwinbox.com')
  assert.equal(darwinbox.parser, 'custom-script')
  assert.match(darwinbox.modulePath, /darwinbox[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Darwinbox script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const darwinbox = scrapers.find((scraper) => scraper.name === 'darwinbox')

  assert.ok(darwinbox)
  assert.equal(typeof darwinbox.run, 'function')
  assert.equal(darwinbox.provider.adapter, 'script')
  assert.equal(darwinbox.provider.parser, 'custom-script')
  assert.equal(darwinbox.provider.companyCareerPage, 'https://darwinbox.com/en-us/careers')
})
