import test from 'node:test'
import assert from 'node:assert/strict'
import { hashClassificationInput } from '../src/services/jobClassificationPolicy.js'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { trialNativeInputHash } from '../scripts/trialNativePredictionCache.js'
import { buildClassificationReviewRepair, repairClassificationReviews, validateClassificationReviewManifest } from '../scripts/repairClassificationReviews.js'

const now = new Date('2026-11-13T03:05:48Z')
function fixture() {
  const job = { _id: '6af3654c81d29bdba17ac4d7', title: 'Trainee', status: 'active', jobType: 'Full-time Experienced',
    sourceDescription: 'experience required(yrs):\n1 - 2\njob description:\nBuild and maintain telecommunications systems and prepare technical reports.' }
  const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
    scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
  const input = postScrapeInput(job, { now })
  const oldInput = { ...input, runtimeHash: 'prior-policy-runtime' }
  const inputHash = hashClassificationInput(oldInput)
  const classification = { ...resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' }),
    runtimeHash: oldInput.runtimeHash, inputHash }
  classification.resolved.experienceProfile.maximumYears = 15
  classification.resolved.employerExperienceProfile.maximumYears = null
  job.classification = classification
  job.postClassification = { inputHash, mode: 'policy', status: 'completed', result: {
    classification: structuredClone(classification), prediction, nativeInputHash: trialNativeInputHash(input) } }
  const manualReview = { id: job._id, classificationInputHash: inputHash, finalJobType: job.jobType,
    independentJobType: 'Full-time Experienced', independentEmployerExperience: { minimumYears: 1, maximumYears: 2 },
    verdict: 'misclassified', readFullOriginal: true }
  return { job, manualReview }
}

test('numeric repair retains a valid review flag while correcting independently reviewed employer bounds', () => {
  const { job, manualReview } = fixture()
  assert.equal(buildClassificationReviewRepair(job, { now }), null)
  const operation = buildClassificationReviewRepair(job, { now, manualReview })
  assert.equal(operation?.update.$set.experienceProfile.maximumYears, 2)
  assert.equal(operation.update.$set.classification.resolved.employerExperienceProfile.maximumYears, 2)
  assert.deepEqual(operation.update.$set.classification.reviewReasons, ['entry_level_title_with_required_experience'])
  assert.equal(operation.filter['postClassification.result.nativeInputHash'], job.postClassification.result.nativeInputHash)
  assert.equal(job.classification.resolved.experienceProfile.maximumYears, 15)
})

test('numeric repair rejects an unverified replacement, changed source and changed inference', () => {
  for (const mutate of [
    ({ manualReview }) => { delete manualReview.independentEmployerExperience },
    ({ manualReview }) => { manualReview.independentEmployerExperience.maximumYears = 3 },
    ({ job }) => { job.sourceDescription += ' Minimum 5 years of professional experience is required.' },
    ({ job }) => { job.postClassification.result.nativeInputHash = 'changed' },
  ]) {
    const data = fixture()
    mutate(data)
    assert.equal(buildClassificationReviewRepair(data.job, { now, manualReview: data.manualReview }), null)
  }
})

test('manifest repair limits its query to reviewed IDs and preview makes no writes', async () => {
  const { job, manualReview } = fixture()
  let writes = 0, filter
  const cursor = { async *[Symbol.asyncIterator]() { yield job }, async close() {} }
  const query = { sort() { return this }, lean() { return this }, cursor() { return cursor } }
  const model = { find(value) { filter = value; return query }, async updateOne() { writes++; return { modifiedCount: 1 } } }
  const summary = await repairClassificationReviews({ model, manualReviews: [manualReview], now: () => now,
    refreshSummary: async () => { throw new Error('Preview must not refresh persisted summaries') } })
  assert.deepEqual(filter._id, { $in: [job._id] })
  assert.equal(summary.eligible, 1)
  assert.equal(summary.updated, 0)
  assert.equal(writes, 0)
})

test('reviewed unusable source may be quarantined only when the current policy confirms the exact source issue', () => {
  const data = fixture()
  data.job.title = 'Analyst'
  data.job.sourceDescription = 'Apply via the employer careers page.'
  const input = postScrapeInput(data.job, { now })
  const oldInput = { ...input, runtimeHash: 'prior-policy-runtime' }
  const hash = hashClassificationInput(oldInput)
  data.job.classification = { ...resolvePostScrapeClassification(data.job,
    data.job.postClassification.result.prediction, { now, mode: 'policy' }),
    inputHash: hash, runtimeHash: oldInput.runtimeHash, resolved: { jobType: 'Full-time Experienced' } }
  data.job.postClassification.inputHash = hash
  data.job.postClassification.result.classification = structuredClone(data.job.classification)
  data.job.postClassification.result.nativeInputHash = trialNativeInputHash(input)
  const manualReview = { ...data.manualReview, classificationInputHash: hash, verdict: 'source_quality',
    independentJobType: 'Unspecified', expectedSourceQualityIssues: ['sparse_role_description'] }
  delete manualReview.independentEmployerExperience
  const result = buildClassificationReviewRepair(data.job, { now, manualReview })
  assert.equal(result?.update.$set.jobType, 'Unspecified')
  assert.equal(result.update.$set.classification.status, 'uncertain')
  assert.equal(buildClassificationReviewRepair(data.job, { now, manualReview: {
    ...manualReview, expectedSourceQualityIssues: ['closed_vacancy'] } }), null)
})

test('a malformed or duplicate manifest is rejected before any database read', async () => {
  const { manualReview } = fixture()
  for (const manualReviews of [[], [manualReview, { ...manualReview, id: manualReview.id.toUpperCase() }],
    [{ ...manualReview, classificationInputHash: 'stale' }]]) {
    assert.throws(() => validateClassificationReviewManifest(manualReviews))
    await assert.rejects(repairClassificationReviews({ manualReviews, model: {
      find() { assert.fail('Invalid manifests must not read jobs') } } }))
  }
})
