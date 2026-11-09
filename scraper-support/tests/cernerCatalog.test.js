import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cerner as an Oracle Cloud script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const cerner = catalog.find((provider) => provider.source === 'cerner')

  assert.ok(cerner)
  assert.equal(cerner.adapter, 'script')
  assert.equal(cerner.atsPlatform, 'oracle-cloud')
  assert.match(cerner.companyCareerPage, /careers\.oracle\.com\/en\/sites\/jobsearch\/jobs\/\?keyword=Cerner/i)
  assert.equal(cerner.companyDomain, 'careers.oracle.com')
  assert.match(cerner.modulePath, /cerner[\\/]script\.js$/)
})

test('buildScrapers exposes a runnable Cerner scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cerner = scrapers.find((scraper) => scraper.name === 'cerner')

  assert.ok(cerner)
  assert.equal(typeof cerner.run, 'function')
  assert.match(cerner.dryRunFile, /cerner[\\/]jobs\.json$/)
  assert.equal(cerner.provider.source, 'cerner')
  assert.equal(cerner.provider.atsPlatform, 'oracle-cloud')
})
