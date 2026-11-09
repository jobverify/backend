import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

import Job from '../../src/models/Job.js'
import { createAccordSoftwareAndSystemsScraper } from '../../scraper/accordsoftwaresystems/script.js'
import { extractYatraJobs } from '../../scraper/yatra/script.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { generateFingerprint, saveToDB } from '../utils/saveToDB.js'

const now = new Date('2026-10-24T10:00:00.000Z')
const options = {
  now, enrichPublicExperience: false, enqueueAlerts: false,
  descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false,
}
let mongo
let originalFetch

before(async () => {
  assert.equal(mongoose.connection.readyState, 0, 'Never reuse an application database connection')
  originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('External network forbidden in identity regression tests') }
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false'
  mongo = new MongoMemoryServer({
    instance: { ip: '127.0.0.1' },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../../.cache/mongodb-binaries/', import.meta.url)) },
  })
  await mongo.start()
  const uri = mongo.getUri()
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 })
  await mongoose.connection.db.collection('jobs').createIndex({ fingerprint: 1 }, { unique: true })
})

beforeEach(async () => { await Job.deleteMany({}) })

after(async () => {
  await mongoose.disconnect()
  await mongo?.stop()
  globalThis.fetch = originalFetch
})

const role = (id, title = 'Software Engineer', overrides = {}) => ({
  jobId: id, requisitionId: id, title, company: 'Shared form regression',
  city: 'Bengaluru', location: 'Bengaluru, India', country: 'India',
  sourceUrl: 'https://example.invalid/opportunities',
  applyUrl: 'https://example.invalid/resume/upload-start',
  sourceDescription: `Responsibilities and qualifications for ${title}.`,
  sourceListingComplete: false, scrapedAt: now.toISOString(), ...overrides,
})

test('unmarked shared URLs preserve distinct native requisitions with identical titles', async () => {
  const jobs = [role('req-100'), role('req-101')]
  const untouched = structuredClone(jobs)
  const saved = await saveToDB(jobs, 'shared-form-regression', options)
  assert.equal(saved.inserted, 2)
  assert.equal(saved.updated, 0)
  assert.equal(await Job.countDocuments({}), 2)
  assert.deepEqual((await Job.find({}).sort({ jobId: 1 }).lean()).map(job => job.jobId), ['req-100', 'req-101'])
  assert.deepEqual(jobs, untouched, 'Identity resolution must not mutate raw source evidence')
})

test('a later smaller shared-form inventory updates its surviving role without inserting duplicates', async () => {
  await saveToDB([role('req-100'), role('req-101')], 'shared-form-regression', options)
  const saved = await saveToDB([role('req-101', 'Senior Software Engineer')], 'shared-form-regression', options)
  assert.equal(saved.inserted, 0)
  assert.equal(saved.updated, 1)
  assert.equal(await Job.countDocuments({}), 2)
  assert.equal((await Job.findOne({ jobId: 'req-101' }).lean()).title, 'Senior Software Engineer')
  assert.equal((await Job.findOne({ jobId: 'req-100' }).lean()).title, 'Software Engineer')
})

test('a legacy shared-URL record is reassigned only to its matching native role', async () => {
  const existing = normalizeScrapedJob(role('req-100'), { source: 'shared-form-regression' })
  await Job.create({ ...existing, fingerprint: generateFingerprint(existing), source: 'shared-form-regression', status: 'active' })
  const saved = await saveToDB([role('req-100'), role('req-101')], 'shared-form-regression', options)
  assert.equal(saved.inserted, 1)
  assert.equal(saved.updated, 1)
  assert.equal(await Job.countDocuments({}), 2)
  assert.deepEqual((await Job.find({}).sort({ jobId: 1 }).lean()).map(job => job.jobId), ['req-100', 'req-101'])
})

test('shared-form recovery uses the correct prior role content when the inventory shrinks', async () => {
  await saveToDB([
    role('req-100', 'Engineering', { sourceDescription: 'Build production APIs and distributed systems.' }),
    role('req-101', 'Testing', { sourceDescription: 'Validate embedded firmware and hardware.' }),
  ], 'shared-form-regression', options)
  await saveToDB([role('req-101', 'Testing', {
    sourceDescription: null, jobDescription: null, description: null, preserveExistingSourceContent: true,
  })], 'shared-form-regression', options)
  assert.equal(await Job.countDocuments({}), 2)
  assert.equal((await Job.findOne({ jobId: 'req-101' }).lean()).sourceDescription, 'Validate embedded firmware and hardware.')
})

test('new singleton roles remember a previously observed shared application surface', async () => {
  await saveToDB([role('req-100'), role('req-101')], 'shared-form-regression', options)
  const third = await saveToDB([role('req-102')], 'shared-form-regression', options)
  const fourth = await saveToDB([role('req-103')], 'shared-form-regression', options)
  assert.equal(third.inserted, 1)
  assert.equal(fourth.inserted, 1)
  assert.equal(fourth.updated, 0)
  assert.deepEqual((await Job.find({}).sort({ jobId: 1 }).lean()).map(job => job.jobId), [
    'req-100', 'req-101', 'req-102', 'req-103',
  ])
})

test('duplicate roles cannot upsert against an obsolete key during legacy migration', async () => {
  const existing = normalizeScrapedJob(role('req-100'), { source: 'shared-form-regression' })
  await Job.create({ ...existing, fingerprint: generateFingerprint(existing), source: 'shared-form-regression', status: 'active' })
  const saved = await saveToDB([role('req-100'), role('req-100'), role('req-101')], 'shared-form-regression', options)
  assert.equal(saved.inserted, 1)
  assert.equal(saved.updated, 1)
  assert.deepEqual((await Job.find({}).sort({ jobId: 1 }).lean()).map(job => job.jobId), ['req-100', 'req-101'])
})

test('concurrent refreshes can safely reuse the same legacy migration snapshot', async t => {
  const existing = normalizeScrapedJob(role('req-100'), { source: 'shared-form-regression' })
  await Job.create({ ...existing, fingerprint: generateFingerprint(existing), source: 'shared-form-regression', status: 'active' })
  const find = Job.find
  let lookups = 0
  let release
  const barrier = new Promise(resolve => { release = resolve })
  t.mock.method(Job, 'find', function (...args) {
    const query = find.apply(this, args)
    if (args[0]?.$or) {
      const exec = query.exec
      query.exec = async function (...execArgs) {
        const rows = await exec.apply(this, execArgs)
        if (++lookups === 2) release()
        await barrier
        return rows
      }
    }
    return query
  })
  const results = await Promise.allSettled([
    saveToDB([role('req-100'), role('req-101')], 'shared-form-regression', options),
    saveToDB([role('req-100'), role('req-101')], 'shared-form-regression', options),
  ])
  t.mock.restoreAll()
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'fulfilled'])
  assert.deepEqual((await Job.find({}).sort({ jobId: 1 }).lean()).map(job => job.jobId), ['req-100', 'req-101'])
})

test('role-specific URLs keep one identity when title and upstream ID change', async () => {
  const original = role('upstream-old', 'Software Engineer', {
    applyUrl: 'https://example.invalid/jobs/engineering-100',
    sourceUrl: 'https://example.invalid/jobs/engineering-100',
  })
  await saveToDB([original], 'shared-form-regression', options)
  const saved = await saveToDB([{ ...original, jobId: 'upstream-new', requisitionId: 'upstream-new', title: 'Senior Software Engineer' }], 'shared-form-regression', options)
  assert.equal(saved.inserted, 0)
  assert.equal(saved.updated, 1)
  assert.equal(await Job.countDocuments({}), 1)
})

test('repeated copies of the same role remain one record', async () => {
  const original = role('req-100', 'Engineering')
  await saveToDB([original, { ...original }], 'shared-form-regression', options)
  assert.equal(await Job.countDocuments({}), 1)
})

test('a missing-content duplicate cannot erase a complete description collected in the same batch', async () => {
  const complete = role('req-100', 'Engineering', { sourceDescription: 'Build production APIs and distributed systems.' })
  const fallback = { ...complete, sourceDescription: null, preserveExistingSourceContent: true }
  const saved = await saveToDB([complete, fallback], 'shared-form-regression', options)
  assert.equal(saved.inserted, 1)
  const stored = await Job.findOne({ jobId: 'req-100' }).lean()
  assert.equal(stored.sourceDescription, 'Build production APIs and distributed systems.')
  assert.equal(stored.description, 'Build production APIs and distributed systems.')
})

test('Accord output persists separate roles sharing its unmarked application form', async () => {
  const careers = `<h1>Careers at Accord</h1>
    <p>Creating cutting-edge technology is a way of life at Accord.</p>
    ${['Lead Production Engineer', 'Systems Engineer FPGA'].map(title => `<section>
      <h2>${title}</h2><p>Full Time - ${title}</p>
      <h5>Education Qualification</h5><p>BE/B.Tech ECE</p>
      <h5>Years of experience</h5><p>2 - 3 Years</p>
      <h5>Work Location</h5><p>Bangalore</p>
      <h5>No. of Position</h5><p>1</p>
      <h5>Key skills/JD</h5><p>Build embedded firmware and test production systems.</p>
      <a href="https://www.accord-soft.com/career-form.php">Apply Now</a></section>`).join('')}`
  const applyForm = '<h1>Join Us</h1><h3>Submit Your Resume</h3><p>Accord Software & Systems Pvt Ltd</p><p>resumes@accord-soft.com</p>'
  const jobs = await createAccordSoftwareAndSystemsScraper({ now: () => now.toISOString() }).run({
    fetchText: async url => url.endsWith('/career.php') ? careers : applyForm,
  })
  assert.equal(jobs.length, 2)
  const saved = await saveToDB(jobs, 'accordsoftwaresystems', options)
  assert.equal(saved.inserted, 2)
  assert.equal(saved.updated, 0)
  assert.deepEqual((await Job.find({}).sort({ title: 1 }).lean()).map(job => job.title), [
    'Lead Production Engineer', 'Systems Engineer FPGA',
  ])
})

test('Yatra output persists separate requisitions sharing the job portal and city', async () => {
  const jobs = extractYatraJobs([
    { jobId: '15', title: 'Backend Engineer', location: 'Gurugram - Delhi NCR', description: 'Build backend APIs.' },
    { jobId: '16', title: 'Frontend Engineer', location: 'Gurugram - Delhi NCR', description: 'Build accessible web applications.' },
  ], () => now.toISOString())
  const saved = await saveToDB(jobs, 'yatra', options)
  assert.equal(saved.inserted, 2)
  assert.equal(saved.updated, 0)
  assert.equal(await Job.countDocuments({ source: 'yatra' }), 2)
})
