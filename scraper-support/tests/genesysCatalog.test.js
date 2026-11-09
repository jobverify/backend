import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Genesys as a Workday-backed script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'genesys')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://www.genesys.com/company/careers')
  assert.equal(provider.companyDomain, 'genesys.com')
  assert.match(provider.modulePath, /genesys\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Genesys scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'genesys')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'workday')
  assert.match(provider.dryRunFile, /genesys.workday[\\/]jobs\.json$/)
})
