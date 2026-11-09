import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog binds ARMS native announcements without claiming a qualified guest-job inventory', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'arms4ai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-company-posts-and-unqualified-guest-search')
  assert.equal(provider.sourceCurrentPublicContractReviewedOn,'2026-11-03')
  assert.equal(provider.verifiedIndiaJobCount,null)
  assert.equal(provider.sourceScopeComplete,false)
  assert.equal(provider.lifecycleCleanupAllowed,false)
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/company/arms4ai/')
  assert.equal(provider.companyDomain, 'arms4ai.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /arms4ai[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ARMS 4 AI scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'arms4ai')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.linkedin.com/company/arms4ai/')
})
