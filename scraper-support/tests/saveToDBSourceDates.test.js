import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import { saveToDB } from '../utils/saveToDB.js'
import { applyPublicJobVisibility } from '../../src/utils/publicJobVisibility.js'
import Job from '../../src/models/Job.js'
import { correctExistingSourceLifecycleDates } from '../utils/sourceLifecycleCorrection.js'

const now = new Date('2026-10-25T04:00:00.000Z')
const options = { now, enrichPublicExperience: false, enqueueAlerts: false,
  descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false }
let mongo, database, originalFetch

before(async () => {
  assert.equal(mongoose.connection.readyState, 0)
  originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Network forbidden in local source date tests') }
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' }, binary: { version: '8.2.6' } })
  const uri = mongo.getUri()
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false })
  database = mongoose.connection.db
  await database.collection('jobs').createIndex({ fingerprint: 1 }, { unique: true })
})

after(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
  globalThis.fetch = originalFetch
  assert.equal(mongoose.connection.readyState, 0)
})

const fixture = (id, overrides = {}) => ({
  jobId: id, requisitionId: id, title: 'Software Engineer', company: 'Native date fixture',
  jobType: 'Full-time Experienced',
  location: 'Bengaluru, India', country: 'India',
  sourceUrl: `https://example.invalid/native-dates/${id}`,
  applyUrl: `https://example.invalid/native-dates/${id}`,
  sourceDescription: 'Original employer description.',
  postingDate: '2026-10-24T00:00:00.000Z', scrapedTimestamp: now.toISOString(),
  sourceListingComplete: false, sourceDetailComplete: true, ...overrides,
})
const nativeDates = (job, startDate, endDate = null) => ({
  ...job, postingDate: startDate, postedAt: startDate, closingDate: endDate,
  sourceDateProvenance: 'workday-cxs-jobPostingInfo',
  sourceRawDates: { startDate, endDate },
  postingDatePrecision: 'calendar-date', sourcePostingDateIsExact: false,
  closingDatePrecision: endDate ? 'calendar-date' : null, sourceClosingDateIsExact: false,
})
const row = id => database.collection('jobs').findOne({ requisitionId: id })
const visible = id => database.collection('jobs').countDocuments(applyPublicJobVisibility({
  requisitionId: id, status: 'active',
  $or: [{ closingDate: null }, { closingDate: { $gt: now } }],
}, { experiencedJobsEnabled: true }))

test('a partial rerun corrects a stored false-fresh native date without inserting old jobs or changing content', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const job = fixture('R-old-date', { jobId: null })
  await saveToDB([job], 'local-native-date', options)
  assert.equal(await visible(job.requisitionId), 1)
  const before = await row(job.requisitionId)
  const corrected = nativeDates({ ...job, jobId: job.requisitionId,
    sourceDescription: 'Do not rewrite content during a date-only correction.' }, '2026-06-29')
  const snapshot = structuredClone(corrected)
  const result = await saveToDB([corrected, nativeDates(fixture('R-never-insert-old'), '2026-09-07')],
    'local-native-date', options)
  assert.equal(result.inserted, 0)
  assert.equal(result.filteredOld, 2)
  const after = await row(job.requisitionId)
  assert.equal(after.postedAt.toISOString(), '2026-06-29T00:00:00.000Z')
  assert.equal(result.correctedSourceDates, 1)
  assert.equal(result.updated, 1)
  assert.equal(after.sortDate.toISOString(), after.postedAt.toISOString())
  assert.equal(after.sourceDescription, before.sourceDescription)
  assert.equal(after.scrapedAt.toISOString(), before.scrapedAt.toISOString())
  assert.equal(after.lastSeenAt.toISOString(), before.lastSeenAt.toISOString())
  assert.equal(after.missedScrapeCount, before.missedScrapeCount)
  assert.equal(after.status, before.status)
  assert.equal(await visible(job.requisitionId), 0)
  assert.equal(await row('R-never-insert-old'), null)
  assert.deepEqual(corrected, snapshot)
  const repeated = await saveToDB([corrected], 'local-native-date', options)
  assert.equal(repeated.correctedSourceDates || 0, 0)
  assert.equal(repeated.updated, 0)
})

test('a newly expired native calendar date corrects an existing closing date through the end of its UTC day', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const job = fixture('R-closed-date')
  await saveToDB([job], 'local-native-date', options)
  const result = await saveToDB([nativeDates(job, '2026-10-24', '2026-10-24')], 'local-native-date', options)
  assert.equal(result.filteredClosed, 1)
  assert.equal(result.inserted, 0)
  assert.equal((await row(job.requisitionId)).closingDate.toISOString(), '2026-10-25T00:00:00.000Z')
  assert.equal(result.correctedSourceDates, 1)
  assert.equal(await visible(job.requisitionId), 0)
})

test('unverified, conflicting, malformed, foreign and invalid-URL inputs cannot correct stored native dates', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const cases = [
    ['no-provenance', job => ({ ...nativeDates(job, '2026-09-07'), sourceDateProvenance: null })],
    ['conflicting', job => ({ ...nativeDates(job, '2026-09-07'), sourceRawDates: { startDate: '2026-09-06', endDate: null } })],
    ['malformed', job => nativeDates(job, '2026-06-31')],
    ['foreign', job => nativeDates({ ...job, country: 'United States', location: 'Austin, Texas, United States' }, '2026-09-07')],
    ['invalid-url', job => nativeDates({ ...job, applyUrl: 'javascript:invalid' }, '2026-09-07')],
  ]
  for (const [id, change] of cases) {
    const job = fixture(`R-${id}`)
    await saveToDB([job], 'local-native-date', options)
    const result = await saveToDB([change(job)], 'local-native-date', options)
    assert.equal(result.correctedSourceDates || 0, 0, id)
    assert.equal((await row(job.requisitionId)).postedAt.toISOString(), job.postingDate, id)
  }
})

test('native date correction stays within the same source and role on a shared application URL', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const a = fixture('R-shared-a', { applicationUrlIsGeneric: true, applyUrl: 'https://example.invalid/apply' })
  const b = fixture('R-shared-b', { applicationUrlIsGeneric: true, applyUrl: a.applyUrl })
  await saveToDB([a, b], 'local-native-date', options)
  const untouched = fixture('R-cross-source')
  await saveToDB([untouched], 'other-native-date-source', options)
  const result = await saveToDB([nativeDates(a, '2026-09-07'), nativeDates(untouched, '2026-09-07')],
    'local-native-date', options)
  assert.equal(result.correctedSourceDates, 1)
  assert.equal(await visible(a.requisitionId), 0)
  assert.equal(await visible(b.requisitionId), 1)
  assert.equal(await visible(untouched.requisitionId), 1)
})

test('contradictory native dates for the same stored role do not choose an arbitrary correction', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const job = fixture('R-duplicate-date')
  await saveToDB([job], 'local-native-date', options)
  const result = await saveToDB([nativeDates(job, '2026-09-07'), nativeDates(job, '2026-09-08')],
    'local-native-date', options)
  assert.equal(result.correctedSourceDates || 0, 0)
  assert.equal((await row(job.requisitionId)).postedAt.toISOString(), job.postingDate)
})

test('an exact native expiry keeps its instant while correcting only an existing role', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const job = fixture('R-exact-expiry')
  await saveToDB([job], 'local-native-date', options)
  const corrected = {
    ...nativeDates(job, '2026-10-24', '2026-10-25T03:59:59.123Z'),
    closingDatePrecision: 'timestamp', sourceClosingDateIsExact: true,
  }
  const result = await saveToDB([corrected], 'local-native-date', options)
  assert.equal(result.filteredClosed, 1)
  assert.equal(result.correctedSourceDates, 1)
  assert.equal((await row(job.requisitionId)).closingDate.toISOString(), corrected.closingDate)
  assert.equal(await visible(job.requisitionId), 0)
})

test('a payload naming a different source cannot correct this source even on the same role fingerprint', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const job = fixture('R-payload-other-source')
  await saveToDB([job], 'local-native-date', options)
  const result = await saveToDB([nativeDates({ ...job, source: 'other-source' }, '2026-09-07')],
    'local-native-date', options)
  assert.equal((await row(job.requisitionId)).postedAt.toISOString(), job.postingDate)
  assert.equal(result.correctedSourceDates || 0, 0)
})

test('a newer same-role write between correction lookup and update wins', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +now })
  const job = fixture('R-concurrent-correction')
  await saveToDB([job], 'local-native-date', options)
  const nextDate = new Date('2026-10-25T03:00:00.000Z')
  const facade = {
    find(...args) {
      const query = Job.find(...args), exec = query.exec.bind(query)
      query.exec = async () => {
        const rows = await exec()
        await database.collection('jobs').updateOne({ requisitionId: job.requisitionId }, {
          $set: { postedAt: nextDate, sortDate: nextDate, lastSeenAt: new Date(+now + 1) },
        })
        return rows
      }
      return query
    },
    bulkWrite: (...args) => Job.bulkWrite(...args),
  }
  const changed = await correctExistingSourceLifecycleDates({ jobs: [nativeDates(job, '2026-09-07')],
    source: 'local-native-date', now, JobModel: facade })
  assert.equal((await row(job.requisitionId)).postedAt.toISOString(), nextDate.toISOString())
  assert.equal(changed, 0)
})
