import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import JobDatasetSummary from '../src/models/JobDatasetSummary.js'
import { getAllJobs } from '../src/controllers/jobController.js'
import { refreshJobDatasetSummary } from '../src/services/jobDatasetSummaryService.js'
import { ACCESS_ROLES, PLAN_IDS } from '../src/constants/accessPlans.js'

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  set() { return this },
})

test('job list totals follow effective filters while unfiltered lists retain cached summaries', { timeout: 120000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: {
    version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)),
  } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  const samples = [
    { jobId: 'intern', title: 'Engineering Intern', jobType: 'Internship', company: 'Alpha' },
    { jobId: 'fresher', title: 'Engineer', jobType: 'Full-time Fresher', company: 'Beta' },
    { jobId: 'experienced', title: 'Engineer', jobType: 'Full-time', experienceRequired: 'At least 3 years', company: 'Beta' },
    { jobId: 'contract', title: 'Engineer', jobType: 'Contract', company: 'Alpha' },
    { jobId: 'unknown', title: 'Engineer', jobType: 'Unspecified', company: 'Unknown' },
  ]
  const docs = samples.map(job => ({
    ...job,
    _id: new mongoose.Types.ObjectId(),
    fingerprint: 'controller-summary-test-' + job.jobId,
    source: 'controller-summary-test',
    companyKey: job.company.toLowerCase(),
    status: 'active',
    isPublicIndia: true,
    country: 'India',
    city: 'Bangalore',
    location: 'Bangalore, India',
    locationKeys: ['bangalore'],
    sourceDescription: 'Build and test reliable software for production customers.',
    description: 'Build and test reliable software for production customers.',
    postedAt: null,
    closingDate: null,
  }))
  await Job.collection.insertMany(docs)
  const ids = new Map(docs.map(job => [String(job._id), job.jobId]))
  const summary = await refreshJobDatasetSummary()
  assert.equal(summary.totalJobs, 4)
  assert.equal(summary.totalCompanies, 2)

  const originals = { count: Job.countDocuments, distinct: Job.distinct, summary: JobDatasetSummary.findOne }
  const calls = { count: 0, distinct: 0, summary: 0 }
  Job.countDocuments = function (...args) { calls.count++; return originals.count.apply(this, args) }
  Job.distinct = function (...args) { calls.distinct++; return originals.distinct.apply(this, args) }
  JobDatasetSummary.findOne = function (...args) { calls.summary++; return originals.summary.apply(this, args) }
  t.after(() => {
    Job.countDocuments = originals.count
    Job.distinct = originals.distinct
    JobDatasetSummary.findOne = originals.summary
  })
  const user = {
    role: 'user',
    accessRole: ACCESS_ROLES.MONTHLY,
    premium: { planId: PLAN_IDS.MONTHLY, status: 'active', expiresAt: new Date(Date.now() + 3600000) },
  }
  const all = ['contract', 'experienced', 'fresher', 'intern']
  const cases = [
    { name: 'Intern-only filter', query: { jobType: 'Intern' }, want: ['intern'], companies: 1 },
    { name: 'unknown category stays public-excluded', query: { jobType: 'Unspecified' }, want: [], companies: 0 },
    { name: 'multiple selected categories', query: { jobType: ['Intern', 'Full-time Experienced'] }, want: ['experienced', 'intern'], companies: 2 },
    { name: 'canonical category includes the stored Full-time alias', query: { jobType: 'Full-time Experienced' }, want: ['experienced'], companies: 1 },
    { name: 'Contract-only filter', query: { jobType: 'Contract' }, want: ['contract'], companies: 1 },
    { name: 'category combined with city', query: { jobType: 'Intern', city: 'Bangalore' }, want: ['intern'], companies: 1 },
    { name: 'disabled experienced category', query: { jobType: 'Full-time Experienced' }, settings: { experiencedJobsEnabled: false }, want: [], companies: 0 },
    { name: 'recommended category filter', query: { jobType: 'Intern', sort: 'recommended' }, want: ['intern'], companies: 1 },
    { name: 'recommended unknown category', query: { jobType: 'Unspecified', sort: 'recommended' }, want: [], companies: 0 },
    { name: 'default list', query: {}, want: all, companies: 2, summary: true },
    { name: 'pagination alone keeps summary totals', query: { page: '2', limit: '1' }, total: 4, returned: 1, companies: 2, summary: true },
    { name: 'recommended default keeps summary totals', query: { sort: 'recommended' }, want: all, companies: 2, summary: true },
    { name: 'ignored category has no effective filter', query: { jobType: 'not-a-supported-category' }, want: all, companies: 2, summary: true },
    { name: 'default with experienced visibility disabled counts its own scope', query: {}, settings: { experiencedJobsEnabled: false }, want: ['contract', 'fresher', 'intern'], companies: 2 },
  ]
  for (const entry of cases) await t.test(entry.name, async () => {
    calls.count = calls.distinct = calls.summary = 0
    const res = response()
    await getAllJobs({ query: { limit: '50', ...entry.query }, user, siteSettings: entry.settings }, res)
    assert.equal(res.statusCode, 200)
    if (entry.want) assert.deepEqual(res.body.data.map(job => ids.get(String(job._id))).sort(), entry.want)
    if (entry.returned != null) assert.equal(res.body.data.length, entry.returned)
    assert.equal(res.body.pagination.total, entry.total ?? entry.want.length)
    assert.equal(res.body.pagination.totalCompanies, entry.companies)
    assert.equal(calls.count, entry.summary ? 0 : 1)
    assert.equal(calls.distinct, entry.summary ? 0 : 1)
    assert.equal(calls.summary, entry.summary ? 1 : 0)
  })
})
