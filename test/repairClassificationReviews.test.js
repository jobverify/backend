import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { hashClassificationInput } from '../src/services/jobClassificationPolicy.js'
import { trialNativeInputHash } from '../scripts/trialNativePredictionCache.js'
import { buildClassificationReviewRepair, repairClassificationReviews } from '../scripts/repairClassificationReviews.js'

const now = new Date('2026-11-03T08:00:00Z')
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
const cachedJob = () => {
  const job = { _id: new mongoose.Types.ObjectId(), title: 'Graduate Engineer Trainee', company: 'Review Repair Test',
    fingerprint: 'review-repair', source: 'review-test', status: 'active', jobType: 'Full-time Experienced',
    sourceDescription: 'Responsibilities: Build and test software for our customers.' }
  const input = postScrapeInput(job, { now })
  const oldInput = { ...input, runtimeHash: 'before-entry-level-title-policy' }
  const inputHash = hashClassificationInput(oldInput)
  const result = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
  const saved = { ...result, inputHash, runtimeHash: oldInput.runtimeHash, classifiedAt: new Date(now),
    decisionSource: 'model_fallback', reviewReasons: ['entry_level_title_with_experienced_prediction'],
    comparison: { modelJobType: prediction.modelLabel, logicJobType: 'Unspecified', agreement: false },
    resolved: { ...result.resolved, jobType: 'Full-time Experienced', experienceYears: [],
      experienceBasis: 'unspecified', experienceRequired: null,
      experienceProfile: { minimumYears: null, maximumYears: null, hasExplicitExperience: false } } }
  return { ...job, classification: saved, postClassification: { inputHash, mode: 'policy', status: 'completed',
    result: { classification: structuredClone(saved), prediction: structuredClone(prediction), nativeInputHash: trialNativeInputHash(input) } } }
}

test('cached review repair resolves a trainee and retains employer evidence and original inference', () => {
  const job = cachedJob()
  const before = JSON.stringify(job)
  const operation = buildClassificationReviewRepair(job, { now })
  assert.equal(operation.update.$set.jobType, 'Full-time Fresher')
  assert.equal(operation.update.$set.classification.resolved.employerExperienceProfile.minimumYears, null)
  assert.equal(operation.update.$set.classification.resolved.experienceProfile.hasExplicitExperience, false)
  assert.deepEqual(operation.update.$set.classification.reviewReasons, [])
  assert.equal(operation.filter['postClassification.result.nativeInputHash'], job.postClassification.result.nativeInputHash)
  assert.equal(JSON.stringify(job), before)
})

test('cached review repair rejects changed source, stale inference, invalid predictions and active work', () => {
  for (const change of [
    job => { job.sourceDescription += ' Minimum 3 years of professional experience required.' },
    job => { job.classification.authoritative = false },
    job => { job.classification.policyVersion = 'obsolete' },
    job => { job.classification.modelRevision = 'different-model' },
    job => { job.classification.complete = false },
    job => { job.classification.mode = 'shadow' },
    job => { job.postClassification.mode = 'shadow' },
    job => { job.postClassification.status = 'processing' },
    job => { job.postClassification.inputHash = 'different-input' },
    job => { job.postClassification.result.nativeInputHash = 'different-inference' },
    job => { job.postClassification.result.prediction.fullDescriptionCovered = false },
    job => { job.postClassification.result.classification.resolved.jobType = 'Intern' },
  ]) {
    const job = cachedJob()
    change(job)
    assert.equal(buildClassificationReviewRepair(job, { now }), null)
  }
})

test('cached review repair cannot clear a genuine employer eligibility conflict', () => {
  const job = cachedJob()
  job.title = 'Fresher Engineer'
  job.sourceDescription = 'Minimum 3 years of professional experience required.'
  const result = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
  job.classification = result
  job.postClassification = { inputHash: result.inputHash, mode: 'policy', status: 'completed',
    result: { classification: result, prediction, nativeInputHash: trialNativeInputHash(postScrapeInput(job, { now })) } }
  assert.equal(buildClassificationReviewRepair(job, { now }), null)
})

test('review repair previews, applies once and rejects a concurrent source edit in Mongo', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  const first = cachedJob()
  const concurrent = { ...cachedJob(), fingerprint: 'review-race' }
  await Job.collection.insertMany([first, concurrent])
  let refreshed = 0
  const options = { now: () => now, refreshSummary: async () => { refreshed++ } }
  const preview = await repairClassificationReviews(options)
  assert.equal(preview.eligible, 2)
  assert.equal(preview.updated, 0)
  assert.equal(refreshed, 0)
  assert.equal((await Job.findById(first._id).lean()).jobType, 'Full-time Experienced')
  const updateOne = Job.updateOne.bind(Job)
  let raced = false
  t.mock.method(Job, 'updateOne', async (filter, update) => {
    if (String(filter._id) === String(concurrent._id) && !raced) {
      raced = true
      await updateOne({ _id: concurrent._id }, { $set: { sourceDescription: 'Changed before applying the repair.' } })
    }
    return updateOne(filter, update)
  })
  const applied = await repairClassificationReviews({ ...options, apply: true })
  assert.equal(applied.updated, 1)
  assert.equal(applied.stale, 1)
  assert.equal(refreshed, 1)
  const repaired = await Job.findById(first._id).lean()
  assert.equal(repaired.jobType, 'Full-time Fresher')
  assert.equal(repaired.classification.inputHash, repaired.postClassification.inputHash)
  assert.deepEqual(repaired.postClassification.result.prediction, prediction)
  assert.equal((await Job.findById(concurrent._id).lean()).jobType, 'Full-time Experienced')
  const again = await repairClassificationReviews({ ...options, apply: true })
  assert.equal(again.updated, 0)
  assert.equal(refreshed, 1)
})
