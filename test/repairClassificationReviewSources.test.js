import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js'
import { buildClassificationReviewSourceRepair, repairClassificationReviewSources } from '../scripts/repairClassificationReviewSources.js'

const now = new Date('2026-11-03T08:00:00Z')
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
const sourceJob = (fields = {}) => {
  const job = { _id: new mongoose.Types.ObjectId(), title: 'Fresher - BD & Sales', company: 'Flexsin Technologies',
    source: 'flexsintechnologies', sourceUrl: 'https://www.flexsin.com/careers/fresher-bd-sales/',
    fingerprint: 'source-review-repair', status: 'active', jobType: 'Unspecified',
    sourceDescription: 'An overcaptured page. Minimum 6 years of professional experience required.',
    sourceExperienceRequired: '6 years', experienceRequired: '6 years', ...fields }
  const input = buildRewriteInput(job)
  job.sourceContentHash = input.inputHash
  job.sourceContentHashVersion = 2
  job.descriptionRewrite = { status: 'published', inputHash: input.inputHash, policyVersion: 'old-rewrite', modelRevision: 'fixture' }
  job.description = 'Old polished wording from the unrelated experience requirement.'
  const classification = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
  classification.classifiedAt = now
  return { ...job, classification, postClassification: { mode: 'policy', status: 'completed', inputHash: classification.inputHash,
    result: { classification, prediction, nativeInputHash: 'old-description-prediction' } } }
}
const receipt = job => ({ status: 200, url: job.sourceUrl, html: `<h1>${job.title}</h1>
  <h4>Job Description:</h4><p>Assist the sales team with customer research, reporting and communication.</p>
  <h4>Required Skills:</h4><p>Basic spreadsheet skills and willingness to learn the sales process.</p>
  <form><label>Minimum 10 years of experience required.</label><input></form>` })

const captionJob = () => ({ _id: new mongoose.Types.ObjectId(), fingerprint: 'tudip-caption-' + new mongoose.Types.ObjectId(),
  title: 'AI Engineer', company: 'Tudip Technologies', source: 'tudiptechnologies', status: 'active',
  sourceUrl: 'https://tudip.com/jobs/india/ai-engineer/', sourceDescription: 'AI Engineer', jobType: 'Full-time Experienced',
  descriptionRewrite: { status: 'baseline' },
  postClassification: { mode: 'policy', status: 'completed', inputHash: 'previous-caption-runtime', result: { prediction } } })
const captionReceipt = job => ({ status: 200, url: job.sourceUrl, html: `<h1>${job.title}</h1>
  <h3>Position Summary</h3><p>Build and maintain artificial intelligence software to support customer applications.</p>
  <h3>Job Requirements/Qualifications</h3><p>Knowledge of Python and statistics and a degree in computer science.</p>` })

test('unflagged Tudip captions recover real descriptions even when source policy still needs model classification', () => {
  const job = captionJob()
  const operation = buildClassificationReviewSourceRepair(job, captionReceipt(job), { now })
  assert.ok(operation)
  assert.equal(operation.proposedJobType, 'Unspecified')
  assert.match(operation.update.$set.sourceDescription, /Build and maintain artificial intelligence software/)
  assert.equal(operation.update.$set.jobType, 'Unspecified')
  assert.equal(operation.update.$set.postClassification.status, 'pending')
  assert.equal(operation.update.$set.postClassification.result, undefined)
  assert.equal(operation.update.$set.descriptionRewrite.status, 'pending')
})

test('caption repair accepts skipped captions but preserves substantive sources and in-flight processing', () => {
  const skipped = captionJob()
  skipped.postClassification = { status: 'skipped', mode: 'policy', reason: 'missing_description' }
  assert.ok(buildClassificationReviewSourceRepair(skipped, captionReceipt(skipped), { now }))
  for (const change of [job => { job.sourceDescription = 'The employer requires practical Python software development skills.' },
    job => { job.postClassification.status = 'processing' },
    job => { job.descriptionRewrite.status = 'processing' },
    job => { job.status = 'expired' },
    job => { job.source = 'another-source' }]) {
    const job = captionJob()
    change(job)
    assert.equal(buildClassificationReviewSourceRepair(job, captionReceipt(job), { now }), null)
  }
})

test('caption recovery previews without writes and rejects concurrent source edits in Mongo', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  const first = captionJob(), concurrent = captionJob()
  await Job.collection.insertMany([first, concurrent])
  const options = { source: 'tudiptechnologies', now: () => now, readPage: async () => captionReceipt(first),
    refreshSummary: async () => {} }
  const preview = await repairClassificationReviewSources(options)
  assert.equal(preview.eligible, 2)
  assert.equal(preview.updated, 0)
  assert.equal((await Job.findById(first._id).lean()).sourceDescription, 'AI Engineer')
  const originalUpdate = Job.updateOne.bind(Job)
  t.mock.method(Job, 'updateOne', async (filter, update) => {
    if (String(filter._id) === String(concurrent._id)) {
      await originalUpdate({ _id: concurrent._id }, { $set: { sourceDescription: 'A concurrent employer source update.' } })
    }
    return originalUpdate(filter, update)
  })
  const applied = await repairClassificationReviewSources({ ...options, apply: true })
  assert.equal(applied.updated, 1)
  assert.equal(applied.stale, 1)
  const changed = await Job.findById(first._id).lean()
  assert.equal(changed.postClassification.status, 'pending')
  assert.equal(changed.jobType, 'Unspecified')
  assert.match(changed.sourceDescription, /Knowledge of Python/)
  assert.equal((await repairClassificationReviewSources({ ...options, apply: true })).eligible, 0)
})

test('source repairs invalidate old rewrite and model caches and retain a pending public category', () => {
  const job = sourceJob()
  const before = JSON.stringify(job)
  const operation = buildClassificationReviewSourceRepair(job, receipt(job), { now })
  assert.equal(operation.proposedJobType, 'Full-time Fresher')
  const set = operation.update.$set
  assert.match(set.sourceDescription, /Basic spreadsheet skills/)
  assert.doesNotMatch(set.sourceDescription, /6 years|10 years/)
  assert.equal(set.sourceExperienceRequired, null)
  assert.equal(set.experienceRequired, null)
  assert.equal(set.descriptionRewrite.status, 'pending')
  assert.equal(set.sourceContentHashVersion, 2)
  assert.notEqual(set.sourceContentHash, job.sourceContentHash)
  assert.equal(set.postClassification.status, 'pending')
  assert.equal(set.postClassification.mode, 'policy')
  assert.equal(set.postClassification.result, undefined)
  assert.equal(set.jobType, 'Unspecified')
  assert.equal(operation.update.$unset.classification, '')
  assert.equal(JSON.stringify(job), before)
})

test('source repairs reject active work, edited source, unverified pages and genuine fresh source conflicts', () => {
  for (const change of [job => { job.sourceDescription += ' Edited.' },
    job => { job.postClassification.status = 'processing' },
    job => { job.classification.authoritative = false },
    job => { job.classification.policyVersion = 'obsolete' }]) {
    const job = sourceJob()
    change(job)
    assert.equal(buildClassificationReviewSourceRepair(job, receipt(job), { now }), null)
  }
  const job = sourceJob()
  assert.equal(buildClassificationReviewSourceRepair(job, { ...receipt(job), url: 'https://www.flexsin.com/careers/' }, { now }), null)
  assert.equal(buildClassificationReviewSourceRepair(job, { ...receipt(job), status: 404 }, { now }), null)
  const conflicting = receipt(job)
  conflicting.html = conflicting.html.replace('Basic spreadsheet skills', 'Minimum 3 years of professional experience required. Basic spreadsheet skills')
  assert.equal(buildClassificationReviewSourceRepair(job, conflicting, { now }), null)
  const labelled = receipt(job)
  labelled.html = labelled.html.replace('</h1>', '</h1><p>Experience: 3 years</p>')
  assert.equal(buildClassificationReviewSourceRepair(job, labelled, { now }), null)
})

test('PlanetSpark source repair replaces unrelated experience with the identified role card', () => {
  const job = sourceJob({ source: 'planetspark', company: 'PlanetSpark', title: 'Inside Sales Associate || Fresher Hiring ||',
    sourceUrl: 'https://www.planetspark.in/careers',
    requisitionId: 'planetspark-inside-sales-associate-fresher-hiring-gurgaon-haryana-india' })
  const response = { status: 200, url: job.sourceUrl, html: `<h1>We're hiring for these roles</h1>
    <div><h4>${job.title}</h4><p>location_on Gurgaon, Haryana</p><p>calendar_today 0 to 3 yrs</p><a>View &amp; Apply</a></div>` }
  const operation = buildClassificationReviewSourceRepair(job, response, { now })
  assert.equal(operation.proposedJobType, 'Full-time Fresher')
  assert.match(operation.update.$set.sourceDescription, /Experience: 0 to 3 yrs/)
  assert.equal(operation.update.$set.postClassification.status, 'pending')
})

test('source repair previews, caches shared page reads, rejects concurrent edits and queues changed jobs in Mongo', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  const first = sourceJob(), concurrent = { ...sourceJob(), fingerprint: 'source-review-race' }
  await Job.collection.insertMany([first, concurrent])
  let reads = 0, refreshed = 0
  const options = { now: () => now, readPage: async () => { reads++; return receipt(first) },
    refreshSummary: async () => { refreshed++ } }
  const preview = await repairClassificationReviewSources(options)
  assert.equal(preview.eligible, 2)
  assert.equal(preview.updated, 0)
  assert.equal(reads, 1)
  assert.equal((await Job.findById(first._id).lean()).descriptionRewrite.status, 'published')
  const updateOne = Job.updateOne.bind(Job)
  let raced = false
  t.mock.method(Job, 'updateOne', async (filter, update) => {
    if (String(filter._id) === String(concurrent._id) && !raced) {
      raced = true
      await updateOne({ _id: concurrent._id }, { $set: { sourceDescription: 'Changed during source recovery.' } })
    }
    return updateOne(filter, update)
  })
  const applied = await repairClassificationReviewSources({ ...options, apply: true })
  assert.equal(applied.updated, 1)
  assert.equal(applied.stale, 1)
  assert.equal(refreshed, 1)
  const changed = await Job.findById(first._id).lean()
  assert.equal(changed.classification, undefined)
  assert.equal(changed.descriptionRewrite.status, 'pending')
  assert.equal(changed.postClassification.status, 'pending')
  assert.equal(changed.postClassification.result, undefined)
  assert.equal(changed.jobType, 'Unspecified')
  const again = await repairClassificationReviewSources({ ...options, apply: true })
  assert.equal(again.eligible, 0)
  assert.equal(again.updated, 0)
})
