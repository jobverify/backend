import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import ScraperStatus from '../../src/models/ScraperStatus.js'
import ScraperRun from '../../src/models/ScraperRun.js'
import { upsertScraperStatus, writeScraperRun } from '../utils/scraperPersistence.js'
import { openRunCheckpoint } from '../utils/runCheckpoint.js'

const evidence = {
  status: 'complete-inventory', listingComplete: true, firstParty: true, pagesFetched: 1,
  surface: 'https://example.com/careers', verifiedAt: '2026-10-19T00:00:00.000Z',
}
const diagnostics = {
  success: true, jobs: 3, eligibleJobs: 2, rawRecords: 10,
  filteredNonIndia: 7, filteredClosed: 0, filteredInvalidUrl: 0,
  filteredEmptyDescription: 1, filteredNonJob: 0,
  zeroJobEvidence: null, inventoryEvidence: evidence,
  attemptedAt: '2026-10-19T00:00:00.000Z', completedAt: '2026-10-19T00:01:00.000Z',
  staleCheckSkipped: false, staleCheckReason: null,
}

test('checkpoint retains full attempt diagnostics on resume', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'attempt-diagnostics-'))
  try {
    const options = { filePath: path.join(directory, 'checkpoint.json'), sources: ['example'], mode: 'dry', parallel: false }
    openRunCheckpoint(options).markSourceCompleted('example', diagnostics)
    assert.deepEqual(openRunCheckpoint(options).completedSummary().example, diagnostics)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('status and history retain fresh attempt diagnostics without inheriting counts on failure', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  const originalUpdate = ScraperStatus.findOneAndUpdate
  const originalCreate = ScraperRun.create
  let update
  let payload
  ScraperStatus.findOneAndUpdate = async (_filter, value) => { update = value }
  ScraperRun.create = async value => { payload = new ScraperRun(value).toObject() }
  try {
    await upsertScraperStatus('example', diagnostics)
    assert.equal(update.$set.latestAttempt.rawRecords, 10)
    assert.deepEqual(update.$set.latestAttempt.inventoryEvidence, evidence)
    // This fixture has one missing description, so complete history stays intact.
    assert.equal(Object.hasOwn(update.$set, 'lastCompleteCheckAt'), false)
    assert.equal(Object.hasOwn(update.$set, 'lastCompleteJobsFound'), false)
    const doc = new ScraperStatus({ source: 'example', lastRanAt: new Date(), lastSuccess: true, ...update.$set }).toObject()
    assert.equal(doc.latestAttempt.rawRecords, 10)

    await upsertScraperStatus('example', {
      success: true, jobs: 0, completedAt: diagnostics.completedAt,
      zeroJobEvidence: 'verified-empty',
      inventoryEvidence: {
        status: 'verified-empty', listingComplete: true, firstParty: true,
        surface: 'https://example.com/careers', pagesFetched: 1,
        reportedTotal: 0, verifiedAt: diagnostics.completedAt,
      },
    })
    assert.equal(new Date(update.$set.lastCompleteCheckAt).toISOString(), diagnostics.completedAt)

    for (const result of [
      { success: false, softFailure: true, failureKind: 'coverage_gap' },
      { success: false, error: 'upstream failed' },
      { success: true, jobs: 0, staleCheckSkipped: true },
      { success: true, jobs: 0 },
      { success: true, jobs: 3 },
      ...[
        { firstParty: false }, { firstParty: undefined }, { surface: undefined },
        { surface: 'file:///careers' }, { verifiedAt: undefined },
        { pagesFetched: 0 },
        { verifiedAt: 'invalid' }, { verifiedAt: '2026-10-19T00:02:00.000Z' },
        { verifiedAt: '2026-10-16T00:00:00.000Z' },
        { status: 'discovery-only' }, { status: 'unverified' },
      ].map(overrides => ({
        success: true, jobs: 3, completedAt: diagnostics.completedAt,
        inventoryEvidence: { ...evidence, ...overrides },
      })),
      { success: true, jobs: 0, inventoryEvidence: { status: 'discovery-only', listingComplete: false } },
    ]) {
      await upsertScraperStatus('example', result)
      assert.equal(Object.hasOwn(update.$set, 'lastCompleteCheckAt'), false)
      assert.equal(update.$set.latestAttempt.rawRecords, null)
      assert.equal(update.$set.latestAttempt.inventoryEvidence, result.inventoryEvidence ?? null)
    }
    await writeScraperRun(new Date(), { example: diagnostics, failed: { success: false, error: 'failed' } })
    const source = payload.sources.get('example')
    for (const key of ['rawRecords', 'filteredNonJob', 'inventoryEvidence', 'zeroJobEvidence']) {
      assert.deepEqual(source[key], diagnostics[key])
    }
    assert.equal(source.attemptedAt.toISOString(), diagnostics.attemptedAt)
    assert.equal(source.completedAt.toISOString(), diagnostics.completedAt)
    assert.equal(payload.sources.get('failed').rawRecords, null)
    assert.equal(payload.sources.get('failed').jobsFound, null)
  } finally {
    ScraperStatus.findOneAndUpdate = originalUpdate
    ScraperRun.create = originalCreate
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor)
    else delete mongoose.connection.readyState
  }
})
