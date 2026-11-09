import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Canva provider metadata captures the verified blocked first-party jobs state', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'canva')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Canva')
  assert.equal(provider.companyCareerPage, 'https://www.lifeatcanva.com/en/jobs/')
  assert.equal(provider.atsPlatform, 'official-first-party-jobs-board')
  assert.equal(provider.companyDomain, 'lifeatcanva.com')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceBoundaryReviewedOn, '2026-11-03')
  assert.match(provider.extractionStrategy, /unavailable-inventory-gap/i)
  assert.match(provider.verifiedSurfaceSummary, /Access-denied responses leave inventory unverified/i)
  assert.match(provider.verifiedSurfaceSummary, /stops at the first non-success response/i)
})

test('Canva is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'canva')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /canva[\\/]jobs\.json$/)
})
