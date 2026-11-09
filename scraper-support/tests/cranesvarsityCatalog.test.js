import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Cranes Varsity official WordPress job feed', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'cranesvarsity')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.companyCareerPage, 'https://cranesvarsity.com/career/')
  assert.equal(provider.companyDomain, 'cranesvarsity.com')
})

test('buildScrapers exposes a runnable Cranes Varsity scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'cranesvarsity')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cranesvarsity[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'cranesvarsity')
})
