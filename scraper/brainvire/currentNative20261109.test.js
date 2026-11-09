import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { inspectNativeInventory, sha256 } from './nativeContract.js'
import { runNativeBrainvire } from './nativeRun.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packet = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261109.json.gz', import.meta.url))))

test('Brainvire current experience ranges and hybrid locations match their own structured records', () => {
  assert.equal(sha256(packet.body), packet.sha256)
  const inventory = inspectNativeInventory(packet.body, { now: '2026-11-09T08:00:00Z' })
  assert.equal(inventory.records.length, 7)
  const role = inventory.records.find(job => job.title === 'Account Based Marketing Specialist')
  assert.equal(role.countryCode, 'IN')
  assert.equal(role.experienceRequired, '2\u20134 Years')
  assert.equal(role.remoteStatus, 'Hybrid')
  assert.deepEqual(role.locations, ['Mumbai'])
  assert.equal(role.nativeStructuredRecord.experienceRequirements.monthsOfExperience, 24)
  assert.equal(role.sourceDetailComplete, false)
})

test('Brainvire retains five current India summaries without claiming full inventory or full descriptions', async () => {
  const jobs = await runNativeBrainvire({ fetchText: async () => packet.body,
    requestIntervalMs: 0, now: '2026-11-09T08:00:00Z' })
  assert.equal(jobs.length, 5)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.lifecycleCleanupAllowed === false))
})

test('Brainvire still rejects contradictory experience and country evidence', () => {
  for (const changed of [packet.body.replaceAll('"monthsOfExperience":24', '"monthsOfExperience":12'),
    packet.body.replace(/("title":"Team Lead Odoo"[\s\S]*?"addressCountry":)"IN"/, '$1"US"')]) {
    assert.throws(() => inspectNativeInventory(changed, { now: '2026-11-09T08:00:00Z' }), /matching structured|countries conflict/)
  }
})
