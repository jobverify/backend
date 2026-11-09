import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js'
import { getAuthoritativeClassification } from '../src/services/jobClassificationPolicy.js'
import { classifySavedJobs } from '../scripts/classifySavedJobs.js'

const now = new Date('2026-11-04T04:00:00Z')
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }

test('a role title alone is missing descriptive evidence even when wrapped in markup or spacing', () => {
  for (const sourceDescription of ['AI Engineer', '<p>AI Engineer</p>', ' ai\n engineer ']) {
    const job = { title: 'AI Engineer', sourceDescription }
    const before = structuredClone(job)
    const input = postScrapeInput(job, { now })
    assert.equal(input.body, '')
    assert.equal(input.incomplete, true)
    assert.deepEqual(job, before)
  }
})

test('a matching published rewrite cannot make a title-only employer source sufficient for classification', () => {
  const job = { title: 'AI Engineer', sourceDescription: 'AI Engineer',
    description: 'Build artificial intelligence applications and collaborate with the engineering team.' }
  const inputHash = buildRewriteInput(job).inputHash
  job.sourceContentHash = inputHash
  job.descriptionRewrite = { status: 'published', inputHash, policyVersion: 'old-rewrite', modelRevision: 'fixture' }
  assert.equal(postScrapeInput(job, { now }).body, '')
  assert.equal(postScrapeInput(job, { now }).incomplete, true)
})

test('independent structured requirements remain usable when the description is a title caption', () => {
  const input = postScrapeInput({ title: 'AI Engineer', sourceDescription: 'AI Engineer',
    minimumQualification: 'Bachelor degree in computer science.', sourceExperienceRequired: '3 years' }, { now })
  assert.equal(input.incomplete, false)
  assert.match(input.body, /Minimum qualifications:\nBachelor degree/)
  assert.match(input.body, /Required professional experience:\n3 years/)
  assert.doesNotMatch(input.body, /^AI Engineer$/m)
})

test('real role content stays usable regardless of length or a repeated role-title heading', () => {
  for (const sourceDescription of ['Experience: 0 years', 'AI Engineer\nResponsibilities: Build and test applications.']) {
    const input = postScrapeInput({ title: 'AI Engineer', sourceDescription }, { now })
    assert.equal(input.incomplete, false)
    assert.equal(input.body, sourceDescription)
  }
})

test('skipping a legacy title-only job removes its obsolete public category without invoking the model', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  const job = { title: 'AI Engineer', company: 'Tudip Technologies', source: 'tudiptechnologies',
    fingerprint: 'legacy-title-only', sourceDescription: 'Minimum 3 years of professional experience required.', status: 'active' }
  const classification = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
  const saved = await Job.create({ ...job, ...classification.resolved, classification,
    postClassification: { status: 'completed', mode: 'policy', inputHash: classification.inputHash,
      result: { classification, prediction } } })
  await Job.updateOne({ _id: saved._id }, { $set: { sourceDescription: 'AI Engineer' } })
  await t.test('shadow skips preserve public fields owned by policy mode', async () => {
    const result = await classifySavedJobs({ mode: 'shadow', now: () => now, worker: { classify: async () => prediction } })
    assert.equal(result.skipped, 1)
    const after = await Job.findById(saved._id).lean()
    assert.equal(after.jobType, 'Full-time Experienced')
    assert.equal(after.classification.inputHash, classification.inputHash)
  })
  let requests = 0
  const result = await classifySavedJobs({ mode: 'policy', now: () => now,
    worker: { classify: async () => { requests++; return prediction } } })
  assert.equal(result.skipped, 1)
  assert.equal(result.skipReasons.missing_description, 1)
  assert.equal(result.failed, 0)
  assert.equal(requests, 0)
  const after = await Job.findById(saved._id).lean()
  assert.equal(after.jobType, 'Unspecified')
  assert.equal(after.classification, undefined)
  assert.equal(getAuthoritativeClassification(after), null)
  assert.equal(after.experienceProfile, null)
  assert.equal(after.postClassification.status, 'skipped')
  assert.equal(after.postClassification.result, undefined)
})
