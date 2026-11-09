import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import mongoose from 'mongoose'
import ScraperRun from '../../src/models/ScraperRun.js'
import ScraperStatus from '../../src/models/ScraperStatus.js'
import { upsertScraperStatus, writeScraperRun } from '../utils/scraperPersistence.js'

const packets = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/auth0/test-data/delegation-20261031.json.gz', import.meta.url)))).packets
const delegation = { source: 'auth0', verifiedAt: packets[0].capturedAt, sources: ['okta'], preservesChildSourceAndCompany: true,
  evidence: { method: 'official-careers-redirect', url: packets[0].url,
    responses: packets.map(p => ({ url: p.url, finalUrl: p.finalUrl, status: p.status, sha256: p.sha256 })) } }

for (const [field, value] of Object.entries({
  inventoryDelegationEvidence: delegation,
  retry: { attemptsUsed: 2, retries: 1, retryDelayMs: 5000 },
  retryPressure: { nestedScopes: 2, nestedAttempts: 3, nestedRetries: 1,
    nestedFailedAttempts: 1, nestedRetryDelayMs: 5000, httpStatusCounts: { 429: 1 },
    sourceAdmission: { groups: ['workday:wd5'], admittedAttempts: 1, queuedAttempts: 1, queueWaitMs: 200 } },
})) test(`${field} survives the real status/history writer and Mongoose source schema`, async t => {
  // Stub only the MongoDB IO. Exercise production mapping and real strict
  // Mongoose casting; a permissive fake create() would miss dropped fields.
  const original = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  t.after(() => original ? Object.defineProperty(mongoose.connection, 'readyState', original) : delete mongoose.connection.readyState)
  let status, history
  t.mock.method(ScraperStatus, 'findOneAndUpdate', async (_filter, update) => { status = update.$set.latestAttempt;return {} })
  t.mock.method(ScraperRun, 'create', async input => { history = new ScraperRun(input).toObject({ flattenMaps: true });return {} })
  const result = { success: true, jobs: 0, eligibleJobs: 0, partial: true,
    completedAt: '2026-10-31T08:19:00.000Z', [field]: value }
  await upsertScraperStatus('auth0', result)
  await writeScraperRun(new Date('2026-10-31T08:19:00Z'), { auth0: result })
  assert.deepEqual(status[field], value)
  assert.deepEqual(history.sources.auth0[field], value)
})
