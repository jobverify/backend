import assert from 'node:assert/strict'
import test from 'node:test'

import ScraperRun from '../src/models/ScraperRun.js'

test('ScraperRun history has a 90-day TTL retention index', () => {
  const indexes = ScraperRun.schema.indexes()
  const ttlIndex = indexes.find(([keys]) => keys.ranAt === 1)

  assert.ok(ttlIndex)
  assert.equal(ttlIndex[1].expireAfterSeconds, 90 * 24 * 60 * 60)
})
