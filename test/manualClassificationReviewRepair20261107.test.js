import test from 'node:test'
import assert from 'node:assert/strict'
import { hashClassificationInput } from '../src/services/jobClassificationPolicy.js'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { trialNativeInputHash } from '../scripts/trialNativePredictionCache.js'
import { buildClassificationReviewRepair } from '../scripts/repairClassificationReviews.js'

const now = new Date('2026-11-07T00:00:00Z')
const fixture = () => {
  const job = { _id: '6aecc73709828b3c88fa8da3', title: 'Graduate Engineer Trainee', company: 'Manual Audit Test',
    source: 'manual-audit-test', status: 'active', jobType: 'Full-time Experienced',
    sourceDescription: 'Responsibilities: Build and test software under the guidance of senior engineers.' }
  const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
    scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
  const input = postScrapeInput(job, { now })
  const previousInput = { ...input, runtimeHash: 'prior-policy-runtime' }
  const inputHash = hashClassificationInput(previousInput)
  const classification = { ...resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' }),
    inputHash, runtimeHash: previousInput.runtimeHash, reviewReasons: [],
    resolved: { jobType: 'Full-time Experienced' } }
  job.classification = classification
  job.postClassification = { inputHash, mode: 'policy', status: 'completed', result: {
    classification: structuredClone(classification), prediction, nativeInputHash: trialNativeInputHash(input) } }
  const manualReview = { id: job._id, classificationInputHash: inputHash, finalJobType: job.jobType,
    independentJobType: 'Full-time Fresher', verdict: 'misclassified', readFullOriginal: true }
  return { job, manualReview }
}

test('a full manual review can repair an unflagged record only to its independently established category', () => {
  const { job, manualReview } = fixture()
  assert.equal(buildClassificationReviewRepair(job, { now }), null)
  const operation = buildClassificationReviewRepair(job, { now, manualReview })
  assert.equal(operation?.update.$set.jobType, 'Full-time Fresher')
  assert.deepEqual(operation.filter['classification.reviewReasons'], [])
  assert.equal(operation.filter['classification.inputHash'], manualReview.classificationInputHash)
  assert.equal(job.jobType, 'Full-time Experienced')
})

test('mismatched manual evidence and a corrected policy that disagrees with the reviewer cannot change saved labels', () => {
  for (const mutate of [
    r => { r.id = 'different-record' },
    r => { r.classificationInputHash = 'different-input' },
    r => { r.finalJobType = 'Contract' },
    r => { r.independentJobType = 'Contract' },
    r => { r.verdict = 'conflicting_source' },
    r => { r.readFullOriginal = false },
  ]) {
    const { job, manualReview } = fixture()
    mutate(manualReview)
    assert.equal(buildClassificationReviewRepair(job, { now, manualReview }), null)
  }
})

test('a manually reviewed record still rejects changed employer content and stale native inference', () => {
  for (const mutate of [
    job => { job.sourceDescription += ' Prior professional experience is required.' },
    job => { job.postClassification.result.nativeInputHash = 'different-native-input' },
    job => { job.postClassification.status = 'processing' },
  ]) {
    const { job, manualReview } = fixture()
    mutate(job)
    assert.equal(buildClassificationReviewRepair(job, { now, manualReview }), null)
  }
})
