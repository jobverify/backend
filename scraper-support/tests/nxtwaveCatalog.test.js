import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes NxtWave as a Freshteam custom script provider with verified India metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nxtwave')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NxtWave')
  assert.match(provider.modulePath, /nxtwave[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://nxtwave.freshteam.com/jobs')
  assert.equal(provider.companyDomain, 'ccbp.in')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-board')
  assert.equal(provider.extractionStrategy, 'public-freshteam-board+detail-page-apply-surface')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
})

test('buildScrapers exposes a runnable NxtWave scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nxtwave')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /nxtwave[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'nxtwave')
  assert.equal(scraper.provider.adapter, 'script')
  assert.match(scraper.provider.modulePath, /nxtwave[\\/]script\.js$/i)
  assert.equal(scraper.provider.atsPlatform, 'freshteam')
  assert.equal(scraper.provider.countryFilter, 'India')
  assert.equal(scraper.provider.paginationStrategy, 'single-public-board')
  assert.equal(scraper.provider.extractionStrategy, 'public-freshteam-board+detail-page-apply-surface')
  assert.equal(scraper.provider.parser, 'custom-script')
  assert.equal(scraper.provider.companyCareerPage, 'https://nxtwave.freshteam.com/jobs')
  assert.equal(scraper.provider.companyDomain, 'ccbp.in')
})
