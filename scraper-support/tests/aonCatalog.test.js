import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the AON API script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const aon = catalog.find((provider) => provider.source === 'aon')

  assert.ok(aon)
  assert.equal(aon.adapter, 'script')
  assert.equal(aon.atsPlatform, 'icims')
  assert.match(aon.companyCareerPage, /jobs\.aon\.com\/jobs/i)
  assert.equal(aon.companyDomain, 'jobs.aon.com')
  assert.match(aon.modulePath, /aon[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable AON scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const aon = scrapers.find((scraper) => scraper.name === 'aon')

  assert.ok(aon)
  assert.equal(typeof aon.run, 'function')
  assert.match(aon.dryRunFile, /aon[\\/]jobs\.json$/)
  assert.equal(aon.provider.source, 'aon')
  assert.equal(aon.provider.atsPlatform, 'icims')
})
