import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Corizo as a script provider backed by the official WordPress jobs API', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'corizo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://corizo.in/career/')
  assert.equal(provider.companyDomain, 'corizo.in')
  assert.match(provider.modulePath, /corizo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Corizo scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'corizo')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /corizo[\\/]jobs\.json$/)
})
