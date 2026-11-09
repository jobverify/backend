import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ITC Infotech as an official Zwayam script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'itcinfotech')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.companyName, 'ITC Infotech')
  assert.equal(provider.companyCareerPage, 'https://jobs.itcinfotech.com/itcinfotech/jobslist')
  assert.equal(provider.companyDomain, 'jobs.itcinfotech.com')
  assert.equal(provider.zwayamCompanyId, 'MTUxNTQ=')
  assert.equal(provider.zwayamDetailCompanyId, '15154')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedInventoryStatus, 'coverage-gap')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedPublicListingRowCount, 236)
  assert.equal(provider.verifiedIndiaListingRowCount, 236)
  assert.equal(provider.paginationStrategy, 'public-zwayam-total-count-plus-publisher-page-size')
  assert.match(provider.modulePath, /itcinfotech[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ITC Infotech scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'itcinfotech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'itcinfotech')
  assert.equal(scraper.provider.atsPlatform, 'zwayam')
  assert.match(scraper.dryRunFile, /itcinfotech[\\/]jobs\.json$/)
})
