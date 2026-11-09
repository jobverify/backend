import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import User from '../src/models/User.js'
import JobDatasetSummary from '../src/models/JobDatasetSummary.js'
import { refreshJobDatasetSummary, JOB_DATASET_SUMMARY_KEY, JOB_DATASET_LIFECYCLE_VERSION } from '../src/services/jobDatasetSummaryService.js'
import { saveToDB } from '../scraper-support/utils/saveToDB.js'
import { applyPublicJobVisibility } from '../src/utils/publicJobVisibility.js'

const observedAt = new Date('2026-10-21T12:00:00.000Z')
const options = { now: observedAt, enrichPublicExperience: false, descriptionRewriteMode: 'off',
  enqueueAlerts: false, replaceExisting: false, refreshDatasetSummary: false }
const settings = { experiencedJobsEnabled: true }
let mongo, originalFetch

before(async () => {
  assert.equal(mongoose.connection.readyState, 0)
  originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Network forbidden during isolated public closing tests') }
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' }, binary: { version: '8.2.6' } })
  const uri = mongo.getUri()
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false })
  assert.equal(mongoose.connection.host, '127.0.0.1')
})

after(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
  globalThis.fetch = originalFetch
  assert.equal(mongoose.connection.readyState, 0)
})

const input = (id, closing = {}) => ({ jobId: id, title: 'Software Engineer', company: 'Local native expiry fixture',
  // These lifecycle scenarios start with a known public category; classification
  // of an unresolved source role is verified separately in modelPublicJobTypes.
  jobType: 'Full-time Experienced',
  source: 'local-public-expiry', country: 'India', city: 'Bengaluru', location: 'Bengaluru, India',
  sourceUrl: `https://example.invalid/public-expiry/${id}`, applyUrl: `https://example.invalid/public-expiry/${id}`,
  sourceDescription: 'Build reliable services and maintain production software systems.',
  postingDate: observedAt.toISOString(), scrapedAt: observedAt.toISOString(), ...closing })
const visible = id => Job.countDocuments(applyPublicJobVisibility({ jobId: id, status: 'active' }, settings))

test('public queries expire a native calendar closing date at the stored exclusive next UTC midnight', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  const id = 'calendar-midnight'
  await saveToDB([input(id, { closingDate: '2026-10-21', sourceClosingDateIsExact: false })], 'local-public-expiry', options)
  const stored = await Job.findOne({ jobId: id }).lean()
  assert.equal(stored.closingDate.toISOString(), '2026-10-22T00:00:00.000Z')
  t.mock.timers.setTime(+stored.closingDate - 1)
  assert.equal(await visible(id), 1)
  t.mock.timers.setTime(+stored.closingDate)
  assert.equal(await visible(id), 0, 'An exclusive next-day timestamp must not add a second public closing day')
})

for (const exact of [true, undefined]) test(`public queries honor the stored closing instant for ${exact ? 'exact native' : 'legacy'} timestamps`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  const id = exact ? 'exact-instant' : 'legacy-instant', closingDate = '2026-10-21T14:30:45.123Z'
  await saveToDB([input(id, { closingDate, ...(exact ? { sourceClosingDateIsExact: true } : {}) })], 'local-public-expiry', options)
  t.mock.timers.setTime(+new Date(closingDate) - 1)
  assert.equal(await visible(id), 1)
  t.mock.timers.setTime(+new Date(closingDate))
  assert.equal(await visible(id), 0, 'A closed instant must not stay visible until UTC midnight')
})

test('saved-job endpoints cannot list or accept an expired native role later on the same day', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  const id = 'saved-expired-instant', closingDate = '2026-10-21T14:00:00.000Z'
  await saveToDB([input(id, { closingDate, sourceClosingDateIsExact: true })], 'local-public-expiry', options)
  const job = await Job.findOne({ jobId: id }).lean(), userId = new mongoose.Types.ObjectId()
  await User.collection.insertOne({ _id: userId, savedJobs: [job._id] })
  const { getSavedJobs, saveJob } = await import('../src/controllers/userController.js')
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  t.mock.timers.setTime(+new Date(closingDate) + 1)
  const listed = response()
  await getSavedJobs({ user: { _id: userId }, siteSettings: settings }, listed)
  assert.equal(listed.statusCode, 200)
  assert.equal(listed.body.data.length, 0)
  const saved = response()
  await saveJob({ user: { _id: userId }, params: { jobId: String(job._id) }, siteSettings: settings }, saved)
  assert.equal(saved.statusCode, 404)
  assert.equal(saved.body.message, 'Job not found')
  assert.equal((await User.findById(userId).lean()).savedJobs.length, 0)
})

test('unknown closing dates remain visible while unrelated posting-date rules still apply', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  await saveToDB([input('unknown-closing')], 'local-public-expiry', options)
  t.mock.timers.setTime(+new Date('2026-10-22T12:00:00.000Z'))
  assert.equal(await visible('unknown-closing'), 1)
})

const statsResponse = () => ({ statusCode: 200, set() { return this },
  status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })

test('cached public totals refresh when the first native closing instant arrives within the same UTC day', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  const closingDate = '2026-10-21T12:30:00.000Z'
  await saveToDB([input('summary-intraday-expiry', { closingDate, sourceClosingDateIsExact: true })], 'local-public-expiry', options)
  const before = await refreshJobDatasetSummary()
  t.mock.timers.setTime(+new Date(closingDate))
  const expected = await Job.countDocuments(applyPublicJobVisibility({ status: 'active' }, settings))
  assert.equal(before.totalJobs, expected + 1)
  const { getJobStats } = await import('../src/controllers/jobController.js')
  const response = statsResponse()
  await getJobStats({ siteSettings: settings }, response)
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data.totalJobs, expected, 'Cached totals must not include a role excluded by the current public query')
  assert.equal(before.nextClosingAt.toISOString(), closingDate)
  const after = await JobDatasetSummary.findOne({ key: JOB_DATASET_SUMMARY_KEY }).lean()
  assert.equal(after.refreshedAt.toISOString(), closingDate)
  assert.equal(after.nextClosingAt.toISOString(), '2026-10-21T14:00:00.000Z')
})

for (const [label, refreshedAt] of [['missing', undefined], ['future', new Date('2026-10-22T12:00:00.000Z')]]) {
  test(`public totals reject a ${label} summary reference clock`, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
    await JobDatasetSummary.collection.replaceOne({ key: JOB_DATASET_SUMMARY_KEY }, {
      key: JOB_DATASET_SUMMARY_KEY, lifecycleVersion: JOB_DATASET_LIFECYCLE_VERSION,
      totalJobs: 999, totalCompanies: 999, companies: [], cities: [], jobTypes: [],
      nextClosingAt: null, ...(refreshedAt ? { refreshedAt } : {}),
    }, { upsert: true })
    const { getJobStats } = await import('../src/controllers/jobController.js')
    const response = statsResponse()
    await getJobStats({ siteSettings: settings }, response)
    assert.equal(response.statusCode, 200)
    assert.equal(response.body.data.totalJobs, await Job.countDocuments(applyPublicJobVisibility({ status: 'active' }, settings)))
  })
}

test('summary reference time remains bound to its query when aggregation crosses UTC midnight', async t => {
  const before = new Date('2026-10-21T23:59:59.999Z'), after = new Date('2026-10-22T00:00:00.000Z')
  t.mock.timers.enable({ apis: ['Date'], now: +before })
  assert.equal(mongoose.connection.host, '127.0.0.1')
  await Job.collection.deleteMany({})
  await JobDatasetSummary.collection.deleteMany({})
  await saveToDB([input('summary-month-boundary', { postingDate: '2026-09-21T00:00:00.000Z' })],
    'local-public-expiry', { ...options, now: before })
  const original = Job.aggregate
  let snapshot
  Job.aggregate = function (...args) {
    const query = original.apply(this, args), execute = query.exec.bind(query)
    query.exec = async () => {
      const result = await execute()
      t.mock.timers.setTime(+after)
      return result
    }
    return query
  }
  try { snapshot = await refreshJobDatasetSummary() }
  finally { Job.aggregate = original }
  assert.equal(snapshot.totalJobs, 1)
  assert.equal(await Job.countDocuments(applyPublicJobVisibility({ status: 'active' }, settings)), 0)
  const { getJobStats } = await import('../src/controllers/jobController.js')
  const response = statsResponse()
  await getJobStats({ siteSettings: settings }, response)
  assert.equal(response.body.data.totalJobs, 0, 'A pre-midnight result must not be cached as the following lifecycle day')
  assert.equal(snapshot.refreshedAt.toISOString(), before.toISOString())
})

test('cached totals refresh at the next publication and ignore roles closed before publication', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  await Job.collection.deleteMany({})
  await JobDatasetSummary.collection.deleteMany({})
  const publication = new Date('2026-10-21T13:00:00.000Z')
  const row = (id, postedAt, closingDate = null) => ({ fingerprint: id, jobId: id,
    source: 'local-public-expiry', title: 'Engineer', company: id, isPublicIndia: true,
    status: 'active', country: 'India', city: 'Bangalore', jobType: 'Intern',
    sourceDescription: 'Build reliable software services.', postedAt, closingDate })
  await Job.collection.insertMany([
    row('already-public', observedAt),
    row('future-public', publication),
    row('closed-before-publication', new Date(+observedAt + 1), observedAt),
    row('closes-at-publication', new Date(+observedAt + 2), new Date(+observedAt + 2)),
  ])
  const snapshot = await refreshJobDatasetSummary()
  assert.equal(snapshot.totalJobs, 1)
  assert.equal(snapshot.nextPublicationAt?.toISOString(), publication.toISOString())
  t.mock.timers.setTime(+publication)
  const { getJobStats } = await import('../src/controllers/jobController.js')
  const response = statsResponse()
  await getJobStats({ siteSettings: settings }, response)
  assert.equal(response.body.data.totalJobs, 2)
  assert.equal(await Job.countDocuments(applyPublicJobVisibility({ status: 'active' }, settings)), 2)
})

for (const elapsedMs of [0, 1]) test(`an older concurrent aggregation cannot regress a newer summary after ${elapsedMs} milliseconds`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  await Job.collection.deleteMany({})
  await JobDatasetSummary.collection.deleteMany({})
  await saveToDB([input('concurrent-summary-first')], 'local-public-expiry', options)
  let enter, release
  const entered = new Promise(resolve => { enter = resolve })
  const released = new Promise(resolve => { release = resolve })
  const aggregate = Job.aggregate
  let held = false
  t.mock.method(Job, 'aggregate', function (...args) {
    const query = aggregate.apply(this, args), execute = query.exec.bind(query)
    query.exec = async () => {
      const rows = await execute()
      if (!held) { held = true; enter(); await released }
      return rows
    }
    return query
  })
  const olderPending = refreshJobDatasetSummary()
  await entered
  t.mock.timers.setTime(+observedAt + elapsedMs)
  await saveToDB([input('concurrent-summary-second')], 'local-public-expiry', { ...options, now: new Date() })
  let newer
  try { newer = await refreshJobDatasetSummary() }
  finally { release() }
  const older = await olderPending
  assert.equal(newer.totalJobs, 2)
  assert.equal(older.totalJobs, 2, 'The slower caller must receive the winning summary')
  const stored = await JobDatasetSummary.findOne({ key: JOB_DATASET_SUMMARY_KEY }).lean()
  assert.equal(stored.totalJobs, 2)
  assert.equal(stored.refreshedAt.toISOString(), newer.refreshedAt.toISOString())
})

for (const [label, referenceAt] of [['future', new Date(+observedAt + 60000)], ['valid', observedAt]]) {
test(`legacy duplicate summaries with a ${label} anchor clock force an initial refresh`, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  await Job.collection.deleteMany({})
  await JobDatasetSummary.collection.deleteMany({})
  await saveToDB([input('duplicate-summary-current')], 'local-public-expiry', options)
  const summary = { key: JOB_DATASET_SUMMARY_KEY, lifecycleVersion: JOB_DATASET_LIFECYCLE_VERSION,
    totalJobs: 999, totalCompanies: 999, companies: [], cities: [], jobTypes: [],
    nextClosingAt: null, nextPublicationAt: null }
  const firstId = new mongoose.Types.ObjectId('000000000000000000000001')
  await JobDatasetSummary.collection.insertMany([
    { ...summary, _id: firstId, refreshedAt: referenceAt },
    { ...summary, _id: new mongoose.Types.ObjectId('000000000000000000000002'), refreshedAt: observedAt },
  ])
  const { getJobStats } = await import('../src/controllers/jobController.js')
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = statsResponse()
    await getJobStats({ siteSettings: settings }, response)
    assert.equal(response.body.data.totalJobs, 1)
  }
  assert.equal(await JobDatasetSummary.countDocuments({ key: JOB_DATASET_SUMMARY_KEY }), 2, 'Repair must not delete legacy peer cache rows')
  assert.equal((await JobDatasetSummary.findById(firstId).lean()).totalJobs, 1)
})
}

test('an impossible published generation cannot protect corrupt cached totals from repair', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: +observedAt })
  await Job.collection.deleteMany({})
  await JobDatasetSummary.collection.deleteMany({})
  await saveToDB([input('invalid-published-generation')], 'local-public-expiry', options)
  await JobDatasetSummary.collection.insertOne({ key: JOB_DATASET_SUMMARY_KEY,
    lifecycleVersion: JOB_DATASET_LIFECYCLE_VERSION, totalJobs: 999, totalCompanies: 999,
    companies: [], cities: [], jobTypes: [], refreshedAt: observedAt,
    refreshSequence: 1, publishedSequence: 999, nextClosingAt: null, nextPublicationAt: null })
  const { getJobStats } = await import('../src/controllers/jobController.js')
  const response = statsResponse()
  await getJobStats({ siteSettings: settings }, response)
  assert.equal(response.body.data.totalJobs, 1)
  const stored = await JobDatasetSummary.findOne({ key: JOB_DATASET_SUMMARY_KEY }).lean()
  assert.equal(stored.totalJobs, 1)
  assert.equal(stored.publishedSequence, 2)
})
