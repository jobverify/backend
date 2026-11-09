import test from 'node:test'
import assert from 'node:assert/strict'
import * as yellow from '../../scraper/yellowmessenger/script.js'
import { makeZohoFixture, zohoFixtureOptions } from './fixtures/zohoNativeOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Yellow Messenger preserves its source identity while extracting current Yellow.ai native roles', async () => {
  const data = makeZohoFixture('yellowmessenger'), jobs = await yellow.run(zohoFixtureOptions(data))
  assert.equal(yellow.SOURCE, 'yellowmessenger')
  assert.equal(yellow.COMPANY, 'Yellow Messenger')
  assert.equal(yellow.OFFICIAL_BRAND, 'Yellow.ai')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Yellow Messenger')
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Yellow does not certify empty inventory from the embed when the native board is unavailable', async () => {
  const data = makeZohoFixture('yellowmessenger'), base = zohoFixtureOptions(data)
  data.rows = []
  await assert.rejects(yellow.run({ ...base, fetchPage: async (url, init) => {
    const page = await base.fetchPage(url, init)
    if (url === data.spec.board) page.status = 404
    return page
  } }), /employer page/)
})

test('Yellow cancellation rejects before native requests', async () => {
  const data = makeZohoFixture('yellowmessenger')
  await assert.rejects(yellow.run({ ...zohoFixtureOptions(data), signal: AbortSignal.abort() }))
  assert.deepEqual(data.requests, [])
})
