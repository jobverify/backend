import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Capgemini custom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const capgemini = catalog.find((provider) => provider.source === 'capgemini')

  assert.ok(capgemini)
  assert.equal(capgemini.adapter, 'script')
  assert.equal(capgemini.atsPlatform, 'official-company-careers')
  assert.match(capgemini.companyCareerPage, /capgemini\.com\/careers\/join-capgemini\/job-search/i)
  assert.equal(capgemini.companyDomain, 'capgemini.com')
})

test('buildScrapers exposes a runnable Capgemini scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const capgemini = scrapers.find((scraper) => scraper.name === 'capgemini')

  assert.ok(capgemini)
  assert.equal(typeof capgemini.run, 'function')
  assert.match(capgemini.dryRunFile, /capgemini[\\/]jobs\.json$/)
  assert.equal(capgemini.provider.source, 'capgemini')
  assert.equal(capgemini.provider.atsPlatform, 'official-company-careers')
})
