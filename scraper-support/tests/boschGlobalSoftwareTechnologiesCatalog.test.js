import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bosch Global Software Technologies with Bosch jobs metadata', () => {
  const catalog = getScraperCatalog()
  const bgst = catalog.find((provider) => provider.source === 'boschglobalsoftwaretechnologies')

  assert.ok(bgst)
  assert.equal(bgst.adapter, 'script')
  assert.equal(bgst.atsPlatform, 'bosch-content-api')
  assert.match(bgst.companyCareerPage, /jobs\.bosch\.com\/en/i)
  assert.equal(bgst.companyDomain, 'jobs.bosch.com')
})

test('buildScrapers exposes a runnable Bosch Global Software Technologies scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bgst = scrapers.find((scraper) => scraper.name === 'boschglobalsoftwaretechnologies')

  assert.ok(bgst)
  assert.equal(typeof bgst.run, 'function')
  assert.match(bgst.dryRunFile, /boschglobalsoftwaretechnologies[\\/]jobs\.json$/)
  assert.equal(bgst.provider.source, 'boschglobalsoftwaretechnologies')
  assert.equal(bgst.provider.atsPlatform, 'bosch-content-api')
})
