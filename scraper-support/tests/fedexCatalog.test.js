import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes FedEx as an official careers script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'fedex')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.fedex.com/jobs')
  assert.equal(provider.companyDomain, 'careers.fedex.com')
  assert.match(provider.modulePath, /fedex[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable FedEx scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'fedex')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /fedex[\\/]jobs\.json$/)
})
