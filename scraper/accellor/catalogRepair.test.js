import test from 'node:test'
import assert from 'node:assert/strict'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

test('the effective registry selects current phase4 implementations without inventing publication counts', () => {
  const catalog = getScraperCatalog()
  for (const [source, platform, policy] of [['accellor', 'gem', 'evidence-required'], ['affirm', 'greenhouse', 'coverage-gap'], ['aembit', 'bamboohr', 'evidence-required']]) {
    const rows = catalog.filter(row => row.source === source)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].adapter, 'script')
    assert.equal(rows[0].atsPlatform, platform)
    assert.equal(rows[0].zeroResultPolicy, policy)
    assert.equal(rows[0].verifiedIndiaJobCount, null)
    assert.equal(rows[0].verifiedPublicJobCount, null)
  }
  const affirm = catalog.find(row => row.source === 'affirm')
  assert.equal(affirm.backfillMode, 'discovery-only')
  assert.equal(affirm.sourceScopeComplete, false)
  assert.equal(affirm.lifecycleCleanupAllowed, false)
  assert.equal(catalog.find(row => row.source === 'aembit').positiveExtractionStatus, 'unverified-open-backlog')
})
