import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Gadgeon as a browser-rendered official careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gadgeon')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Gadgeon')
  assert.equal(provider.companyCareerPage, 'https://www.gadgeon.com/joinus/')
  assert.equal(provider.companyDomain, 'gadgeon.com')
  assert.match(provider.modulePath, /gadgeon[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Gadgeon scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gadgeon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /gadgeon[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'gadgeon')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
})
