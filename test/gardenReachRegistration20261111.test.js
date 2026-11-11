import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { GARDEN_REACH_SHIPBUILDERS_CATALOG } from '../scraper/gardenreachshipbuilders/catalog.js'

test('registered Garden Reach metadata uses the same current notice contract as its source catalog', () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'gardenreachshipbuilders')
  assert.ok(provider)
  for (const key of ['paginationStrategy', 'extractionStrategy', 'verifiedOn', 'verifiedSurfaceSummary']) {
    assert.equal(provider[key], GARDEN_REACH_SHIPBUILDERS_CATALOG[key], key)
  }
})

test('registered Garden Reach preserves unknown individual vacancy totals and explicit scope holds', () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'gardenreachshipbuilders')
  assert.equal(provider.companyName, 'Garden Reach Shipbuilders')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyCareerPage, 'https://www.grse.in/career/index')
  for (const key of ['sourceScopeComplete', 'sourceListingComplete', 'lifecycleCleanupAllowed']) {
    assert.equal(provider[key], false, key)
  }
  for (const key of ['companyIndiaTotal', 'companyGlobalTotal', 'verifiedPublicJobCount', 'verifiedIndiaJobCount']) {
    assert.equal(provider[key], null, key)
  }
})
