import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Wakefit as an official Darwinbox script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wakefit')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'Wakefit')
  assert.equal(
    provider.companyCareerPage,
    'https://wakefit.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(provider.companyDomain, 'wakefit.darwinbox.in')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'darwinbox-browser-session-listing-api')
  assert.match(provider.modulePath, /wakefit[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Wakefit scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'wakefit')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wakefit')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /wakefit[\\/]jobs\.json$/)
})
