import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cogoport as a verified email-only careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cogoport')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Cogoport')
  assert.equal(provider.companyCareerPage, 'https://www.cogoport.com/company/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-only')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-email-apply-page')
  assert.equal(provider.extractionStrategy, 'verified-email-only-careers-page-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'cogoport.com')
  assert.match(provider.modulePath, /cogoport[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Cogoport sentinel without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cogoport')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cogoport')
  assert.match(scraper.dryRunFile, /cogoport[\\/]jobs\.json$/i)
})
