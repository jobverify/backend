import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Blubridge with its official careers site metadata', () => {
  const catalog = getScraperCatalog()
  const blubridge = catalog.find((provider) => provider.source === 'blubridge')

  assert.ok(blubridge)
  assert.equal(blubridge.adapter, 'script')
  assert.equal(blubridge.atsPlatform, 'react-company-careers')
  assert.match(blubridge.companyCareerPage, /blubridge\.com\/careers/i)
  assert.equal(blubridge.companyDomain, 'blubridge.com')
  assert.equal(blubridge.paginationStrategy, 'single-react-careers-shell+bundle-backed-job-catalog')
  assert.equal(blubridge.extractionStrategy, 'official-react-shell+main-js-bundle+structured-fu-job-data')
  assert.equal(blubridge.verifiedOn, '2026-08-07')
  assert.match(blubridge.verifiedSurfaceSummary, /react app shell/i)
  assert.match(blubridge.verifiedSurfaceSummary, /main\.10737ee8\.js/i)
  assert.match(blubridge.verifiedSurfaceSummary, /four structured India-facing job records/i)
})

test('buildScrapers exposes a runnable Blubridge scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const blubridge = scrapers.find((scraper) => scraper.name === 'blubridge')

  assert.ok(blubridge)
  assert.equal(typeof blubridge.run, 'function')
  assert.match(blubridge.dryRunFile, /blubridge[\\/]jobs\.json$/)
  assert.equal(blubridge.provider.source, 'blubridge')
  assert.equal(blubridge.provider.adapter, 'script')
})
