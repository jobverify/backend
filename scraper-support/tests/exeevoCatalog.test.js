import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Exeevo Inc. as an official empty-state careers scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'exeevo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://exeevo.com/about-us/careers/')
  assert.equal(provider.companyDomain, 'exeevo.com')
  assert.match(provider.modulePath, /exeevo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Exeevo scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'exeevo')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.dryRunFile, /exeevo[\\/]jobs\.json$/)
})
