import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Aptiv HawkSearch script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const aptiv = catalog.find((provider) => provider.source === 'aptiv')

  assert.ok(aptiv)
  assert.equal(aptiv.adapter, 'script')
  assert.equal(aptiv.atsPlatform, 'hawksearch')
  assert.match(aptiv.companyCareerPage, /aptiv\.com\/en\/jobs\/search/i)
  assert.equal(aptiv.companyDomain, 'aptiv.com')
  assert.match(aptiv.modulePath, /aptiv[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Aptiv scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const aptiv = scrapers.find((scraper) => scraper.name === 'aptiv')

  assert.ok(aptiv)
  assert.equal(typeof aptiv.run, 'function')
  assert.match(aptiv.dryRunFile, /aptiv[\\/]jobs\.json$/)
  assert.equal(aptiv.provider.source, 'aptiv')
  assert.equal(aptiv.provider.atsPlatform, 'hawksearch')
})
