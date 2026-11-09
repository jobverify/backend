import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Aiven as a verified first-party script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aiven')

  assert.ok(provider, 'Expected Aiven provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Aiven')
  assert.equal(provider.officialBrandName, 'Aiven')
  assert.equal(provider.companyCareerPage, 'https://aiven.io/careers/job')
  assert.equal(provider.companyDomain, 'aiven.io')
  assert.equal(provider.atsPlatform, 'first-party-job-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-listing-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-listing-page+first-party-detail-pages+india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /aiven[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aiven\.io\/careers\/job/i)
  assert.match(provider.verifiedSurfaceSummary, /35 jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Account Executive Bengaluru, Karnataka, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Support Engineer - Bengaluru/i)
})

test('buildScrapers exposes a runnable Aiven scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'aiven')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'aiven')
  assert.equal(scraper.provider.atsPlatform, 'first-party-job-pages')
  assert.match(scraper.dryRunFile, /aiven[\\/]jobs\.json$/i)
})
