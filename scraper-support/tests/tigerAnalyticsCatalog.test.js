import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Tiger Analytics on the public India SenseHQ board', () => {
  const catalog = getScraperCatalog()
  const tigerAnalytics = catalog.find((provider) => provider.source === 'tigeranalytics')

  assert.ok(tigerAnalytics)
  assert.equal(tigerAnalytics.adapter, 'script')
  assert.equal(tigerAnalytics.atsPlatform, 'sensehq')
  assert.equal(
    tigerAnalytics.companyCareerPage,
    'https://www.tigeranalytics.com/about-us/current-openings/',
  )
  assert.equal(tigerAnalytics.companyDomain, 'tigeranalytics.com')
  assert.match(tigerAnalytics.modulePath, /tigeranalytics[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Tiger Analytics scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const tigerAnalytics = scrapers.find((scraper) => scraper.name === 'tigeranalytics')

  assert.ok(tigerAnalytics)
  assert.equal(typeof tigerAnalytics.run, 'function')
  assert.match(tigerAnalytics.dryRunFile, /tigeranalytics[\\/]jobs\.json$/)
  assert.equal(tigerAnalytics.provider.source, 'tigeranalytics')
  assert.equal(tigerAnalytics.provider.atsPlatform, 'sensehq')
})
