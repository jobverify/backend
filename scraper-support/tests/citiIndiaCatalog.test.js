import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog, buildScrapers } from '../providers/index.js'
for (const source of ['citiindia', 'specindia']) test(source + ': effective native reader clears stale verification and forbids source-wide zero/cleanup', () => {
  const provider = getScraperCatalog().find(row => row.source === source)
  assert.ok(provider);assert.equal(provider.adapter, 'script')
  assert.equal(provider.verifiedOn, null);assert.equal(provider.verifiedInventoryStatus, 'unverified')
  assert.equal(provider.verifiedIndiaJobCount, null);assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.sourceScopeComplete, false);assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.zeroResultPolicy, 'coverage-gap');assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.ok(buildScrapers().find(row => row.name === source))
})
