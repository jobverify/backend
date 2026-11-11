import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { RESERVE_BANK_INFORMATION_TECHNOLOGY_CATALOG as local } from '../scraper/reservebankinformationtechnology/catalog.js'

test('registered ReBIT describes the current browser-contract hold instead of an unverified fourteen-job inventory', () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'reservebankinformationtechnology')
  assert.ok(provider)
  assert.equal(local.verifiedOn, '2026-11-11')
  for (const field of ['paginationStrategy', 'extractionStrategy', 'verifiedOn', 'verifiedSurfaceSummary', 'verificationDisposition']) {
    assert.equal(provider[field], local[field], field)
  }
  assert.equal(provider.verificationDisposition, 'current-careers-program-unqualified-no-login-or-api-read')
})

test('registered ReBIT preserves unknown native totals and forbids cleanup without current source evidence', () => {
  const provider = getScraperCatalog().find(entry => entry.source === 'reservebankinformationtechnology')
  assert.equal(provider.companyName, 'Reserve Bank Information Technology')
  assert.equal(provider.companyCareerPage, 'https://rebit.org.in/careers/')
  assert.equal(provider.countryFilter, 'India')
  for (const field of ['sourceScopeComplete', 'sourceListingComplete', 'lifecycleCleanupAllowed']) {
    assert.equal(provider[field], false, field)
    assert.equal(local[field], false, field)
  }
  for (const field of ['verifiedPublicJobCount', 'verifiedIndiaJobCount', 'companyIndiaTotal', 'companyGlobalTotal', 'nativeLegalEmployer']) {
    assert.equal(provider[field], null, field)
    assert.equal(local[field], null, field)
  }
})
