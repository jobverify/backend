import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Data Conquest as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dataconquest')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyName, 'Data Conquest')
  assert.equal(provider.companyCareerPage, 'https://dataconquest.in/')
  assert.equal(provider.companyDomain, 'dataconquest.in')
  assert.match(provider.modulePath, /dataconquest[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Data Conquest scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'dataconquest')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'dataconquest')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /dataconquest[\\/]jobs\.json$/i)
})
