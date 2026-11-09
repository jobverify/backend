import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes SunTec as a first-party script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'suntec')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'SunTec')
  assert.equal(provider.companyCareerPage, 'https://www.suntecgroup.com/career/')
  assert.equal(provider.companyDomain, 'suntecgroup.com')
  assert.equal(provider.extractionStrategy, 'first-party-inline-openings+best-effort-detail-pages+careers-page-fallback')
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 404/i)
  assert.match(provider.modulePath, /suntec[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable SunTec scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'suntec')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'suntec')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /suntec[\\/]jobs\.json$/i)
})
