import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { RUPEEK_CATALOG } from '../scraper/rupeek/catalog.js'

test('registered Rupeek uses the reviewed corporate reveal and own-detail contract', () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'rupeek')
  assert.ok(provider)
  for (const key of ['paginationStrategy', 'extractionStrategy', 'verifiedOn', 'verifiedSurfaceSummary', 'verificationDisposition']) {
    assert.equal(provider[key], RUPEEK_CATALOG[key], key)
  }
})

test('registered Rupeek retains unknown vacancy totals and scope holds after the first 429', () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'rupeek')
  assert.equal(provider.companyName, 'Rupeek')
  assert.equal(provider.companyCareerPage, 'https://rupeek.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://rupeek.com/about/careers')
  assert.equal(provider.countryFilter, 'India')
  for (const key of ['sourceScopeComplete', 'sourceListingComplete', 'lifecycleCleanupAllowed']) {
    assert.equal(provider[key], false, key)
  }
  for (const key of ['companyIndiaTotal', 'companyGlobalTotal', 'verifiedPublicJobCount', 'verifiedIndiaJobCount', 'nativeLegalEmployer']) {
    assert.equal(provider[key], null, key)
  }
  assert.match(provider.verifiedSurfaceSummary, /first HTTP 429/)
  assert.match(provider.verifiedSurfaceSummary, /no actual closing reads/)
})
