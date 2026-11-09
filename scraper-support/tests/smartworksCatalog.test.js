import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Smartworks as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'smartworks')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Smartworks')
  assert.equal(provider.companyCareerPage, 'https://www.smartworksoffice.com/careers/')
  assert.equal(provider.companyDomain, 'smartworksoffice.com')
  assert.match(provider.modulePath, /smartworks[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Smartworks scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'smartworks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'smartworks')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /smartworks[\\/]jobs\.json$/i)
})
