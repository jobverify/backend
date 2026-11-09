import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { classifySavedJobs } from '../scripts/classifySavedJobs.js'

const now = new Date('2026-11-06T04:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
const prediction = (label = 'Full-time Experienced') => ({ modelLabel: label, windows: 1,
  fullDescriptionCovered: true, scores: Object.fromEntries(labels.map(value => [value, value === label ? .97 : .01])) })
const classify = (job, value = prediction()) => resolvePostScrapeClassification(job, value, { now, mode: 'policy' })
const roleDescription = 'Responsibilities: Develop production software and maintain customer services. '
  + 'Requirements: Knowledge of JavaScript, automated testing, and working with a delivery team.'

test('placeholder-only employer content cannot become a model-only public category', () => {
  for (const sourceDescription of ['.', '-', '---', 'N/A', 'TBD', 'Not available', '<p>&nbsp;-&nbsp;</p>', 'Job Description:']) {
    const input = postScrapeInput({ title: 'Cloud Specialist- Java and Python', sourceDescription }, { now })
    assert.equal(input.body, '', sourceDescription)
    assert.equal(input.incomplete, true, sourceDescription)
  }
})

test('an old published rewrite cannot supply missing evidence for a placeholder employer description', () => {
  const job = { title: 'Cloud Specialist', sourceDescription: '-', description: roleDescription }
  const inputHash = buildRewriteInput(job).inputHash
  job.sourceContentHash = inputHash
  job.descriptionRewrite = { status: 'published', inputHash, policyVersion: 'fixture', modelRevision: 'fixture' }
  assert.equal(postScrapeInput(job, { now }).incomplete, true)
})

test('short real requirements and independent employer fields remain usable', () => {
  for (const sourceDescription of ['Experience: 0 years', 'Build software.', 'Knowledge of SQL.']) {
    const input = postScrapeInput({ title: 'Engineer', sourceDescription }, { now })
    assert.equal(input.body, sourceDescription)
    assert.equal(input.incomplete, false)
  }
  const job = { title: 'Engineer', sourceDescription: '-', sourceExperienceRequired: '3 years' }
  const result = classify(job)
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3)
  assert.doesNotMatch(postScrapeInput(job, { now }).body, /^-$/m)
})

test('an explicit numeric zero experience field is usable employer evidence', () => {
  const job = { title: 'Engineer', sourceDescription: '-', sourceExperienceRequired: 0 }
  assert.equal(postScrapeInput(job, { now }).incomplete, false)
  const result = classify(job)
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
})

test('an explicitly identified system-test posting stays outside supported public categories', () => {
  const job = { title: 'PLEASE DO NOT APPLY-JOB FOR SYSTEM TEST ONLY01', sourceDescription: roleDescription }
  const before = structuredClone(job)
  const result = classify(job, prediction('Intern'))
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.equal(result.status, 'uncertain')
  assert.ok(result.sourceQualityIssues.includes('non_vacancy_test_posting'))
  assert.ok(result.reviewReasons.includes('non_vacancy_test_posting'))
  assert.deepEqual(job, before)
})

test('test-engineering work and restricted internships are genuine role evidence', () => {
  for (const title of ['System Test Engineer', 'Intern, System Test & Validation',
    'Intern - HIC - Pune (Only for Selected Students - Others PLZ DO NOT APPLY)']) {
    const result = classify({ title, sourceDescription: roleDescription }, prediction('Intern'))
    assert.notEqual(result.resolved.jobType, 'Unspecified', title)
    assert.ok(!result.sourceQualityIssues.includes('non_vacancy_test_posting'), title)
  }
})

test('sparse but real model fallback input is reviewable without fabricating numeric experience', () => {
  const result = classify({ title: 'Engineer', sourceDescription: 'Build software services.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.decisionSource, 'model_fallback')
  assert.ok(result.reviewReasons.includes('sparse_role_description'))
  assert.equal(result.resolved.experienceProfile.minimumYears, null)
})

test('a non-majority uncalibrated prediction is reviewed only when it supplies the final category', () => {
  const weak = { ...prediction(), scores: { 'Full-time Experienced': .32, 'Full-time Fresher': .27, Intern: .23, Contract: .18 } }
  const fallback = classify({ title: 'Engineer', sourceDescription: roleDescription }, weak)
  assert.equal(fallback.resolved.jobType, 'Full-time Experienced')
  assert.ok(fallback.reviewReasons.includes('model_fallback_without_majority'))
  const authoritative = classify({ title: 'Engineer', sourceDescription: roleDescription, sourceExperienceRequired: '3 years' }, weak)
  assert.equal(authoritative.resolved.jobType, 'Full-time Experienced')
  assert.ok(!authoritative.reviewReasons.includes('model_fallback_without_majority'))
})

test('entry-level titles with mandatory experience retain employer bounds and gain a review reason', () => {
  for (const title of ['Apprentice', 'External Apprentice', 'Graduate Engineer Trainee']) {
    const result = classify({ title, sourceDescription: roleDescription, sourceExperienceRequired: '3 years' })
    assert.equal(result.resolved.jobType, 'Full-time Experienced', title)
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3, title)
    assert.ok(result.reviewReasons.includes('entry_level_title_with_required_experience'), title)
  }
  const trainer = classify({ title: 'Trainer for Apprentices', sourceDescription: roleDescription, sourceExperienceRequired: '3 years' })
  assert.ok(!trainer.reviewReasons.includes('entry_level_title_with_required_experience'))
})

test('skipping unusable employer content clears old policy fields while shadow mode preserves them', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  t.after(async () => { await mongoose.disconnect(); await mongo.stop() })
  await mongoose.connect(mongo.getUri())
  for (const sourceDescription of ['', '.']) await t.test(JSON.stringify(sourceDescription), async () => {
    await Job.deleteMany({})
    const job = { title: 'Engineer', company: 'Input Repair', fingerprint: 'obsolete-category', status: 'active',
      sourceDescription: 'Minimum 3 years of professional experience required.' }
    const classification = classify(job)
    const saved = await Job.create({ ...job, ...classification.resolved, classification,
      postClassification: { status: 'completed', mode: 'policy', inputHash: classification.inputHash,
        result: { classification, prediction: prediction() } } })
    await Job.updateOne({ _id: saved._id }, { $set: { sourceDescription } })
    const worker = { classify: async () => assert.fail('unusable input reached the model') }
    const shadow = await classifySavedJobs({ worker, mode: 'shadow', now: () => now })
    assert.equal(shadow.skipped, 1)
    assert.equal((await Job.findById(saved._id).lean()).jobType, 'Full-time Experienced')
    const policy = await classifySavedJobs({ worker, mode: 'policy', now: () => now })
    assert.equal(policy.skipped, 1)
    assert.equal(policy.failed, 0)
    const after = await Job.findById(saved._id).lean()
    assert.equal(after.jobType, 'Unspecified')
    assert.equal(after.classification, undefined)
    assert.equal(after.experienceProfile, null)
    assert.equal(after.postClassification.status, 'skipped')
    assert.equal(after.postClassification.reason, 'missing_description')
  })
})
