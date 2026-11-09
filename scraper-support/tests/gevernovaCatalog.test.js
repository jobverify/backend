import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes GE Vernova as an official careers listings scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'gevernova')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://careers.gevernova.com/jobs')
  assert.equal(provider.companyDomain, 'careers.gevernova.com')
  assert.match(provider.modulePath, /gevernova[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GE Vernova scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'gevernova')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'official-company-careers')
  assert.match(provider.dryRunFile, /gevernova[\\/]jobs\.json$/)
})
