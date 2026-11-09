import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Deduce Technologies as a verified apply-only script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deducetechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Deduce Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.deducetechnologies.com/careers')
  assert.equal(provider.companyDomain, 'deducetechnologies.com')
  assert.match(provider.modulePath, /deducetechnologies[\\/]script\.js$/i)
  assert.equal(provider.paginationStrategy, 'homepage-shell-plus-spa-careers-bundle')
  assert.equal(provider.extractionStrategy, 'verified-spa-careers-route+google-form-apply-only-no-public-job-board')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /index-B-wPftlC\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /Google Form/i)
})

test('buildScrapers exposes a runnable Deduce Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'deducetechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'deducetechnologies')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /deducetechnologies[\\/]jobs\.json$/i)
})
