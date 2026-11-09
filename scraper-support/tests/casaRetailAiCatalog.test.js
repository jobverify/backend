import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Casa Retail AI as a verified empty-board script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'casaretailai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyName, 'Casa Retail AI')
  assert.equal(provider.companyCareerPage, 'https://casaretail.ai/company')
  assert.equal(provider.companyDomain, 'casaretail.ai')
  assert.match(provider.modulePath, /casaretailai[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Casa Retail AI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'casaretailai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'casaretailai')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site')
  assert.match(scraper.dryRunFile, /casaretailai[\\/]jobs\.json$/i)
})
