import assert from 'node:assert/strict'
import test from 'node:test'
import { CAREERS_URL, DISPOSITION, run } from '../../scraper/wati/script.js'
import catalog from '../../scraper/wati/catalog.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('WATI uses its officially bound live Workable careers inventory', async () => {
  assert.equal(CAREERS_URL, 'https://www.wati.io/career/')
  assert.equal(DISPOSITION, 'live-native-workable-inventory')
  assert.equal(catalog.atsPlatform, 'workable-native-api')
  assert.equal(catalog.backfillMode, 'live-parser')
  assert.equal(catalog.zeroResultPolicy, 'evidence-required')
  const jobs = await run({ fetchJson: async () => ({ results: [], total: 0 }) })
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})
