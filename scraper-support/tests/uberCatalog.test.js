import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Uber as an Oracle Cloud-backed script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'uber')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.companyName, 'Uber')
  assert.equal(provider.companyCareerPage, 'https://jobs.uber.com/en/')
  assert.equal(provider.companyDomain, 'jobs.uber.com')
  assert.match(provider.modulePath, /uber[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Uber scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'uber')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /uber[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'uber')
  assert.equal(scraper.provider.atsPlatform, 'oracle-cloud')
})
