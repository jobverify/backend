import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Perfios as a verified fail-closed sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'perfios')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Perfios')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox-login-only')
  assert.equal(provider.companyCareerPage, 'https://perfios.ai/careers/')
  assert.equal(provider.companyDomain, 'perfios.ai')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.match(provider.modulePath, /perfios[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/)
})

test('buildScrapers exposes Perfios through the existing runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'perfios')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'perfios')
  assert.match(scraper.dryRunFile, /perfios[\\/]jobs\.json$/i)
})
