import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Snowplow as a HiBob-backed script provider with verified metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'snowplow')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'hibob')
  assert.equal(provider.companyName, 'Snowplow')
  assert.equal(provider.companyCareerPage, 'https://snowplow.io/careers')
  assert.equal(provider.hiBobCareerSiteUrl, 'https://snowplow.careers.hibob.com/')
  assert.equal(provider.hiBobCareerSiteApiUrl, 'https://snowplow.careers.hibob.com/api/career-site')
  assert.equal(provider.hiBobJobBoardApiUrl, 'https://snowplow.careers.hibob.com/api/job-ad')
  assert.equal(provider.companyDomain, 'snowplow.io')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.match(provider.verifiedSurfaceSummary, /companyIdentifier/i)
  assert.match(provider.verifiedSurfaceSummary, /first-party|employer binding/i)
  assert.match(provider.verifiedSurfaceSummary, /closing|Reconcile/i)
  assert.match(provider.modulePath, /snowplow[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Snowplow scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'snowplow')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /snowplow[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'snowplow')
  assert.equal(scraper.provider.atsPlatform, 'hibob')
})
