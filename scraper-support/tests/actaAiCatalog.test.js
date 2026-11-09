import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog binds ACTA.ai to current native observations with unknown vacancy scope', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'actaai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-company-posts-and-unqualified-guest-search')
  assert.equal(provider.sourceCurrentPublicContractReviewedOn,'2026-11-03')
  assert.equal(provider.verifiedPublicJobCount,null)
  assert.equal(provider.sourceScopeComplete,false)
  assert.equal(provider.lifecycleCleanupAllowed,false)
  assert.match(provider.companyCareerPage, /linkedin\.com\/company\/acta-ai/i)
  assert.equal(provider.companyDomain, 'acta.ai')
})

test('buildScrapers exposes a runnable ACTA.ai scraper', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'actaai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /actaai[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'actaai')
  assert.equal(scraper.provider.adapter, 'script')
})
