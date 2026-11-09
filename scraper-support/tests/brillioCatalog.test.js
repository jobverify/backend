import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Brillio with its official job listing metadata', () => {
  const catalog = getScraperCatalog()
  const brillio = catalog.find((provider) => provider.source === 'brillio')

  assert.ok(brillio)
  assert.equal(brillio.adapter, 'script')
  assert.equal(brillio.atsPlatform, 'wordpress-native-search-post')
  assert.equal(brillio.companyCareerPage, 'https://www.brillio.com/careers/')
  assert.equal(brillio.jobsBoardUrl, 'https://careers.brillio.com/job-listing/')
  assert.equal(brillio.companyDomain, 'brillio.com')
  assert.equal(brillio.sourceScopeComplete, true)
  assert.equal(brillio.lifecycleCleanupAllowed, true)
})

test('buildScrapers exposes a runnable Brillio scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const brillio = scrapers.find((scraper) => scraper.name === 'brillio')

  assert.ok(brillio)
  assert.equal(typeof brillio.run, 'function')
  assert.match(brillio.dryRunFile, /brillio[\\/]jobs\.json$/)
  assert.equal(brillio.provider.source, 'brillio')
  assert.equal(brillio.provider.adapter, 'script')
})
