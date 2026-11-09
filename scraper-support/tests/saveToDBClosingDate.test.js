import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { saveToDB } from '../utils/saveToDB.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { applyPublicJobVisibility } from '../../src/utils/publicJobVisibility.js'

const backend = fileURLToPath(new URL('../../', import.meta.url))
const options = { enrichPublicExperience: false, enqueueAlerts: false,
  descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false }
let mongo
let database
let originalFetch

before(async () => {
  assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application database connection')
  originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Network forbidden in isolated closing date tests') }
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false'
  mongo = new MongoMemoryServer({ instance: { ip: '127.0.0.1' }, binary: {
    version: '8.2.6', downloadDir: path.join(backend, '.cache/mongodb-binaries'),
  } })
  await mongo.start()
  const uri = mongo.getUri()
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
  database = mongoose.connection.db
})

after(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
  globalThis.fetch = originalFetch
})

const fixture = (id, now, overrides = {}) => ({
  jobId: id, title: 'Software Engineer', company: 'Closing date local fixture',
  jobType: 'Full-time Experienced',
  location: 'Bengaluru, India', country: 'India',
  sourceUrl: `https://example.invalid/closing-date/${id}`,
  applyUrl: `https://example.invalid/closing-date/${id}`,
  sourceDescription: 'Build and maintain software APIs.',
  postingDate: now.toISOString(), scrapedTimestamp: now.toISOString(),
  ...overrides,
})

// This is the actual public detail/publishing predicate, including its strict
// instant cutoff, composed with the shared public visibility policy.
const visible = (id, now) => database.collection('jobs').countDocuments(applyPublicJobVisibility({
  jobId: id, status: 'active', $or: [{ closingDate: null }, { closingDate: { $gt: now } }],
}, { experiencedJobsEnabled: true }))

for (const [id, closingDate, timestamp, expiry] of [
  ['today', '2026-10-21', '2026-10-21T12:00:00.000Z', '2026-10-22T00:00:00.000Z'],
  ['month-end', '2026-04-30', '2026-04-30T12:00:00.000Z', '2026-05-01T00:00:00.000Z'],
  ['year-end', '2026-12-31', '2026-12-31T12:00:00.000Z', '2027-01-01T00:00:00.000Z'],
  ['leap-day', '2024-02-29', '2024-02-29T12:00:00.000Z', '2024-03-01T00:00:00.000Z'],
  ['before-leap-day', '2024-02-28', '2024-02-28T12:00:00.000Z', '2024-02-29T00:00:00.000Z'],
]) {
  test(`explicit calendar closing date remains publicly visible through ${id}`, async t => {
    const now = new Date(timestamp)
    t.mock.timers.enable({ apis: ['Date'], now: +now })
    const job = fixture(id, now, { closingDate, sourceClosingDateIsExact: false, nativeClosingDate: closingDate })
    const before = structuredClone(job)
    assert.equal(analyzePublishableJobs([job], { now }).eligibleJobs.length, 1)
    const saved = await saveToDB([job], 'local-closing-date', { ...options, now })
    assert.equal(saved.inserted, 1)
    assert.equal(await visible(id, now), 1, 'Eligible closing-day job must remain publicly visible after persistence')
    const row = await database.collection('jobs').findOne({ jobId: id })
    assert.equal(row.closingDate.toISOString(), expiry)
    t.mock.timers.setTime(+new Date(expiry) - 1)
    assert.equal(await visible(id, new Date()), 1, 'Visible until the last millisecond of the calendar day')
    t.mock.timers.setTime(+new Date(expiry))
    assert.equal(await visible(id, new Date()), 0, 'Expires at exclusive next UTC midnight')
    t.mock.timers.setTime(+now)
    await saveToDB([job], 'local-closing-date', { ...options, now })
    assert.equal((await database.collection('jobs').findOne({ jobId: id })).closingDate.toISOString(), expiry)
    assert.deepEqual(job, before, 'Persistence must preserve the raw and native source dates')
  })
}

test('yesterday calendar dates and elapsed exact dates are rejected before persistence', async t => {
  const now = new Date('2026-10-21T12:00:00.000Z')
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const jobs = [
    fixture('yesterday', now, { closingDate: '2026-10-20', sourceClosingDateIsExact: false }),
    fixture('exact-now', now, { closingDate: now.toISOString(), sourceClosingDateIsExact: true }),
    fixture('exact-elapsed', now, { closingDate: '2026-10-21T11:59:59.999Z', sourceClosingDateIsExact: true }),
  ]
  const saved = await saveToDB(jobs, 'local-closing-date', { ...options, now })
  assert.equal(saved.filteredClosed, 3)
  assert.equal(saved.inserted, 0)
  assert.equal(await database.collection('jobs').countDocuments({ jobId: { $in: jobs.map(job => job.jobId) } }), 0)
})

test('exact and legacy closing instants retain their original persistence behavior', async t => {
  const now = new Date('2026-10-21T12:00:00.000Z')
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  for (const [id, closingDate, precision, count] of [
    ['exact-future', '2026-10-21T13:04:05.123Z', true, 1],
    ['legacy-future', '2026-10-21T13:04:05.123Z', undefined, 1],
    ['legacy-midnight', '2026-10-21T00:00:00.000Z', undefined, 0],
    ['legacy-elapsed', '2026-10-21T11:59:59.999Z', undefined, 0],
  ]) {
    const job = fixture(id, now, { closingDate, ...(precision === undefined ? {} : { sourceClosingDateIsExact: precision }) })
    const saved = await saveToDB([job], 'local-closing-date', { ...options, now })
    assert.equal(saved.inserted, 1)
    assert.equal((await database.collection('jobs').findOne({ jobId: id })).closingDate.toISOString(), closingDate)
    assert.equal(await visible(id, now), count)
  }
})

test('missing closing dates stay visible and never erase an existing parsed closing date', async t => {
  const now = new Date('2026-10-21T12:00:00.000Z')
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const job = fixture('unknown-closing', now, { sourceClosingDateIsExact: false })
  assert.equal((await saveToDB([job], 'local-closing-date', { ...options, now })).inserted, 1)
  assert.equal(await visible(job.jobId, now), 1)
  assert.equal((await database.collection('jobs').findOne({ jobId: job.jobId })).closingDate, undefined)
  await saveToDB([{ ...job, closingDate: '2026-10-22T13:04:05.123Z', sourceClosingDateIsExact: true }], 'local-closing-date', { ...options, now })
  await saveToDB([job], 'local-closing-date', { ...options, now })
  assert.equal((await database.collection('jobs').findOne({ jobId: job.jobId })).closingDate.toISOString(), '2026-10-22T13:04:05.123Z')
})

test('explicit calendar precision cannot bypass the one-calendar-month posting cutoff', async t => {
  const now = new Date('2026-10-21T12:00:00.000Z')
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const jobs = [
    fixture('posted-old', now, { postingDate: '2026-09-20T23:59:59.999Z', closingDate: '2026-10-21', sourceClosingDateIsExact: false }),
    fixture('posted-cutoff', now, { postingDate: '2026-09-21T00:00:00.000Z', closingDate: '2026-10-21', sourceClosingDateIsExact: false }),
  ]
  const saved = await saveToDB(jobs, 'local-closing-date', { ...options, now })
  assert.equal(saved.filteredOld, 1)
  assert.equal(saved.inserted, 1)
  assert.equal(await database.collection('jobs').countDocuments({ jobId: 'posted-old' }), 0)
  assert.equal(await visible('posted-cutoff', now), 1)
})
