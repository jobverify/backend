import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Invences is registered against its official homepage with discovery-only inventory semantics', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'invences')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Invences')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://invences.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.paginationStrategy, 'first-party-homepage-handoff-validation')
  assert.equal(provider.extractionStrategy, 'verified-homepage+no-public-listings-discovery-only-without-careers-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'invences.com')
  assert.equal(provider.verifiedOn, '2026-09-14')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /invences[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Invences scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'invences')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /invences[\\/]jobs\.json$/)
})
