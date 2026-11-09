import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('G10X is registered as a verified first-party zero-openings scraper for October 3, 2026', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'g10x')

  assert.ok(provider, 'Expected G10X provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'G10X')
  assert.equal(provider.companyCareerPage, 'https://www.g10x.com/jobs')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-page-plus-jobs-page-plus-missing-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-empty-jobs-page+verified-zero-openings-state+verified-missing-jobs-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'g10x.com')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /0 job openings for you/i)
  assert.match(provider.verifiedSurfaceSummary, /work-with-us/i)
  assert.match(provider.modulePath, /g10x[\\/]script\.js$/i)
})

test('G10X is runnable through the shared scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'g10x')

  assert.ok(scraper, 'Expected buildScrapers() to return the G10X scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'g10x')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.g10x.com/jobs')
  assert.match(scraper.dryRunFile, /g10x[\\/]jobs\.json$/i)
})
