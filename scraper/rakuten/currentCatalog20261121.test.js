import test from 'node:test'
import assert from 'node:assert/strict'
import catalog from './catalog.js'
import { createRakutenScraper, PROVIDER_METADATA } from './script.js'

test('current source catalog binds the actual corporate root, stable factory and finite budgets', () => {
  assert.equal(catalog.source, 'rakuten')
  assert.equal(catalog.companyName, 'Rakuten')
  assert.equal(catalog.companyCareerPage, 'https://corp.rakuten.co.in/')
  assert.equal(catalog.companyDomain, 'corp.rakuten.co.in')
  assert.equal(catalog.legalEmployerName, null)
  assert.equal(catalog.sourceTimeoutMs, 180000)
  assert.equal(catalog.scraperTimeoutMs, 190000)
  assert.equal(PROVIDER_METADATA, catalog)
  assert.equal(typeof createRakutenScraper().run, 'function')
})
test('current source catalog holds company inventory and cleanup authority', () => {
  assert.equal(catalog.sourceScopeComplete, false)
  assert.equal(catalog.companyInventoryComplete, false)
  assert.equal(catalog.lifecycleCleanupAllowed, false)
  assert.match(catalog.extractionStrategy, /paired-India-publication-partials/)
  assert.match(catalog.verifiedSurfaceSummary, /unscoped other-status/)
})
