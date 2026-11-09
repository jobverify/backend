import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CIMCON provider metadata captures the current email-only first-party careers contract', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cimcon')

  assert.ok(provider)
  assert.equal(provider.companyName, 'CIMCON Software India Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://cimcon.com/about-us/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyDomain, 'cimcon.com')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.extractionStrategy, /email-only-openings-return-empty/i)
  assert.match(provider.verifiedSurfaceSummary, /hr@cimcon\.com/i)
})

test('CIMCON is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cimcon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /cimcon[\\/]jobs\.json$/)
})
