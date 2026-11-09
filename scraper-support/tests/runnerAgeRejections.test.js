import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import ScraperRun from '../../src/models/ScraperRun.js'
import ScraperStatus from '../../src/models/ScraperStatus.js'
import { buildScraperAttemptDiagnostics, resolveZeroJobOutcome } from '../runner.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { upsertScraperStatus, writeScraperRun } from '../utils/scraperPersistence.js'
import { openRunCheckpoint } from '../utils/runCheckpoint.js'
import { buildPublishingGapReport, publishingGapCsv } from '../../scripts/publishingGapReport.js'

const now = new Date('2026-10-23T06:00:00Z')
const role = (jobId, extra = {}) => ({
  jobId, title: 'Engineer', location: 'Bengaluru, India',
  applyUrl: `https://example.test/jobs/${jobId}`,
  description: 'Build and maintain software for customers.', postingDate: '2026-10-22', ...extra,
})
const oldRoles = [role('old-1', { postingDate: '2026-06-01' }), role('old-2', { postingDate: '2026-06-02' })]
const diagnostic = jobs => buildScraperAttemptDiagnostics(jobs, analyzePublishableJobs(jobs, { now }))

test('attempt diagnostics account for age rejections without double counting other exclusions', () => {
  const jobs = [role('fresh'), ...oldRoles,
    role('invalid-old', { postingDate: '2026-06-01', applyUrl: 'javascript:alert(1)' }),
    role('foreign-old', { postingDate: '2026-06-01', location: 'London, United Kingdom' }),
    role('closed', { closingDate: '2026-10-20' }),
    role('example-current-openings', { title: 'Current openings at Example', applyUrl: 'https://wellfound.com/company/example/jobs' }),
  ]
  const result = diagnostic(jobs)
  assert.equal(result.rawRecords, 7)
  assert.equal(result.jobs, 6)
  assert.equal(result.eligibleJobs, 1)
  assert.equal(result.filteredOld, 2)
  assert.equal(result.filteredNonIndia + result.filteredClosed + result.filteredInvalidUrl
    + result.filteredNonJob + result.filteredEmptyDescription + result.filteredOld + result.eligibleJobs, 7)
})

test('an inventory of old India roles is distinct from an empty employer inventory', () => {
  const result = diagnostic(oldRoles)
  assert.equal(result.jobs, 2)
  assert.equal(result.eligibleJobs, 0)
  assert.equal(result.filteredOld, 2)
  assert.equal(resolveZeroJobOutcome({ name: 'example' }, oldRoles, oldRoles), null)
})

test('checkpoint and report retain a measured age count while public inventory stays unknown', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-age-checkpoint-'))
  try {
    const options = { filePath: path.join(directory, 'checkpoint.json'), sources: ['example'], mode: 'dry', parallel: false }
    const result = { success: true, ...diagnostic(oldRoles), attemptedAt: now.toISOString(), completedAt: now.toISOString() }
    openRunCheckpoint(options).markSourceCompleted('example', result)
    const checkpoint = openRunCheckpoint(options)
    assert.equal(checkpoint.completedSummary().example.filteredOld, 2)
    const report = buildPublishingGapReport({
      catalog: [{ source: 'example', companyName: 'Example', adapter: 'workday' }], now,
      runState: JSON.parse(fs.readFileSync(options.filePath, 'utf8')),
    })
    assert.equal(report.rows[0].rejectionCounts.old, 2)
    assert.equal(report.rows[0].runtimeOutcome, 'jobs-rejected')
    assert.equal(report.rows[0].savedJobs, null)
    assert.equal(report.rows[0].visibleJobs, null)
    assert.match(publishingGapCsv(report.rows), /""old"":2/)
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()))
    assert.match(path.basename(directory), /^jobverify-age-checkpoint-/)
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('run history model distinguishes missing age evidence from measured zero', () => {
  for (const [value, expected] of [[undefined, null], [null, null], [0, 0], [2, 2]]) {
    const record = new ScraperRun({ sources: { example: {
      success: false, ...(value === undefined ? {} : { filteredOld: value }),
    } } }).toObject().sources.get('example')
    assert.equal(record.filteredOld, expected)
  }
})

test('status and history preserve age measurements and leave unavailable or invalid evidence unknown', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  const originalUpdate = ScraperStatus.findOneAndUpdate
  const originalCreate = ScraperRun.create
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  let update, payload
  ScraperStatus.findOneAndUpdate = async (_filter, value) => { update = value }
  ScraperRun.create = async value => { payload = new ScraperRun(value).toObject() }
  try {
    for (const value of [2, undefined, null, 0, -1, 1.5, '2', false, NaN]) {
      const expected = Number.isSafeInteger(value) && value >= 0 ? value : null
      const result = { success: false, error: 'Fixture failure',
        ...(value === undefined ? {} : { filteredOld: value }) }
      await upsertScraperStatus('example', result)
      assert.equal(update.$set.latestAttempt.filteredOld, expected)
      assert.equal(Object.hasOwn(update.$set, 'lastCompleteCheckAt'), false)
      await writeScraperRun(now, { example: result })
      assert.equal(payload.sources.get('example').filteredOld, expected)
    }
  } finally {
    ScraperStatus.findOneAndUpdate = originalUpdate
    ScraperRun.create = originalCreate
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor)
    else delete mongoose.connection.readyState
  }
})
