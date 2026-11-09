import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Luxoft script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const luxoft = catalog.find((provider) => provider.source === 'luxoft')

  assert.ok(luxoft)
  assert.equal(luxoft.adapter, 'script')
  assert.equal(luxoft.atsPlatform, 'official-company-careers')
  assert.match(luxoft.companyCareerPage, /career\.luxoft\.com\/jobs/i)
  assert.equal(luxoft.companyDomain, 'career.luxoft.com')
  assert.equal(luxoft.parser, 'custom-script')
  assert.match(luxoft.modulePath, /luxoft[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Luxoft script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const luxoft = scrapers.find((scraper) => scraper.name === 'luxoft')

  assert.ok(luxoft)
  assert.equal(typeof luxoft.run, 'function')
  assert.equal(luxoft.provider.adapter, 'script')
  assert.equal(luxoft.provider.parser, 'custom-script')
  assert.match(luxoft.provider.companyCareerPage, /career\.luxoft\.com\/jobs/i)
})
