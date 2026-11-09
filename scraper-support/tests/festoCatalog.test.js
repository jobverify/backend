import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Festo as an official careers search scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'festo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://jobs.festo.com/search/?q=&locationsearch=India')
  assert.equal(provider.companyDomain, 'jobs.festo.com')
  assert.match(provider.modulePath, /festo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Festo scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'festo')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /festo[\\/]jobs\.json$/)
})
