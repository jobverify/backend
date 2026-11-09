import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ClearQuote as a verified no-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'clearquote')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'ClearQuote')
  assert.equal(provider.companyCareerPage, 'https://clearquote.io/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-and-sitemap-validation')
  assert.equal(provider.extractionStrategy, 'verified-first-party-surface-plus-missing-careers-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'clearquote.io')
  assert.match(provider.modulePath, /clearquote[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ClearQuote sentinel without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'clearquote')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'clearquote')
  assert.match(scraper.dryRunFile, /clearquote[\\/]jobs\.json$/i)
})
