import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { inspectAscCareers } from './nativeCareers.js'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const html = gunzipSync(readFileSync(new URL('./fixtures/careers-20261113.html.gz', import.meta.url))).toString()

test('ASC reconciles the current white opening card with its own structured role', () => {
  const inventory = inspectAscCareers(html)
  assert.equal(inventory.nativeCount, 1)
  assert.equal(inventory.jobs[0].title, 'Automated Optical Inspection (AOI) Engineer')
  assert.equal(inventory.jobs[0].country, 'United States')
  assert.deepEqual(inventory.reasons, [])
})

test('ASC qualifies the native foreign-only inventory after a matching closing read', async () => {
  const jobs = await run({ fetchPage: async () => ({ status: 200, url: 'https://ascinternational.com/careers', html }) })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('ASC still rejects unmatched structured roles after the visual theme change', () => {
  const changed = html.replace('Automated Optical Inspection (AOI) Engineer</h3>', 'Different role</h3>')
  assert.notEqual(changed, html)
  assert.throws(() => inspectAscCareers(changed), /matching structured role/)
})
