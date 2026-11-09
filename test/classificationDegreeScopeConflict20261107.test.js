import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { buildClassificationReviewRepair } from '../scripts/repairClassificationReviews.js'
import { trialNativeInputHash } from '../scripts/trialNativePredictionCache.js'

const now = new Date('2026-11-07T00:00:00Z')
const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationDegreeScopeConflict20261107.json', import.meta.url)))
const prediction = label => ({ modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(type => [type, type === label ? .97 : .01])) })
const classify = (job, label = 'Full-time Experienced') => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

test('the complete archived employer input remains reproducible under its recorded identity', () => {
  assert.equal(postScrapeInput(fixture.job, { now, identity: fixture.historicalIdentity }).inputHash, fixture.archivedInputHash)
  assert.equal(createHash('sha256').update(fixture.job.sourceDescription).digest('hex'), fixture.originalTextSha256)
  assert.equal(fixture.sourceReview.independentJobType, null)
  assert.equal(fixture.sourceReview.verdict, 'conflicting_source')
})

for (const label of ['Full-time Experienced', 'Full-time Fresher']) {
  test('the saved degree waiver and separate required history need review regardless of model: ' + label, () => {
    const result = classify(fixture.job, label)
    assert.equal(result.resolved.jobType, 'Unspecified')
    assert.equal(result.status, 'uncertain')
    assert.ok(result.sourceQualityIssues.includes('conflicting_role_eligibility'))
    assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
    assert.equal(result.decisionSource, 'source_policy')
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 2)
    assert.equal(result.resolved.experienceProfile.minimumYears, null)
  })
}

const archivedCandidate = () => {
  const job = { ...structuredClone(fixture.job), jobType: fixture.archivedPublicJobType,
    classification: structuredClone(fixture.archivedClassification),
    postClassification: structuredClone(fixture.archivedPostClassification) }
  job.postClassification.result.nativeInputHash = trialNativeInputHash(postScrapeInput(job, { now }))
  return job
}

test('a requested Fresher correction cannot bypass the unresolved employer source during cached repair', () => {
  const job = archivedCandidate()
  const manualReview = { id: String(job._id), readFullOriginal: true, verdict: 'misclassified',
    classificationInputHash: fixture.archivedInputHash, finalJobType: job.jobType,
    independentJobType: 'Full-time Fresher' }
  assert.equal(buildClassificationReviewRepair(job, { now, manualReview }), null)
})

test('the actual null/conflict manual judgment is never an automatic correction request', () => {
  const job = archivedCandidate()
  const manualReview = { id: String(job._id), readFullOriginal: true, verdict: 'conflicting_source',
    classificationInputHash: fixture.archivedInputHash, finalJobType: job.jobType, independentJobType: null }
  assert.equal(buildClassificationReviewRepair(job, { now, manualReview }), null)
})

const route = "Required qualifications:\nBachelor's degree with 2 years of relevant experience; or Master's degree with no previous professional experience."
const job = body => ({ title: 'Program Engineer', sourceEmploymentType: 'Full-time', sourceDescription: body })
const relatedHistory = '2+ years of related experience in project management or program management.'

test('separate positive related history with unspecified work/academic scope is unresolved', () => {
  const result = classify(job(route + '\n' + relatedHistory + '\nThis is a graduate eligible role.'))
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
})

for (const requirement of [
  '2+ years of related experience in project management for research programs.',
  '2+ years of related experience in project management, excluding academic projects.',
  'Required experience: 2+ years of related experience in project management or program management.',
  '2+ years of related experience in project management, where academic project experience is excluded.',
  '2+ years of related experience in project management, where academic project experience is not accepted.',
]) {
  test('required history keeps its scope without an affirmative academic allowance: ' + requirement, () => {
    const result = classify(job(route + '\n' + requirement))
    assert.equal(result.resolved.jobType, 'Unspecified')
    assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
  })
}

for (const body of [
  route + '\n' + relatedHistory + '\nThis experience can be gained through academic projects, but academic project experience is not accepted.',
  route + '\n2+ years of related experience in project management, including academic projects, but academic project experience is not accepted.',
]) {
  test('contradictory academic credit statements retain review: ' + body, () => {
    const result = classify(job(body))
    assert.equal(result.resolved.jobType, 'Unspecified')
    assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
  })
}

for (const [name, body] of [
  ['preferred history', route + '\nPreferred qualifications:\n' + relatedHistory],
  ['typical history', route + '\n2+ years of related experience in project management is typical.'],
  ['an academic allowance in the same requirement', route + '\n2+ years of related experience in project management, including academic projects.'],
  ['an adjacent explicit academic allowance', route + '\n' + relatedHistory + '\nAcademic project experience satisfies this requirement.'],
  ['history restricted to the experience route', route + '\n2+ years of related experience in project management only for candidates using the experience-based route.'],
  ['recruiting other experienced candidates', route + '\nRecruit candidates with 2+ years of related experience in project management.'],
  ['technical capabilities without an occupational floor', route + '\nExperience coordinating cross-functional teams and applying Python to project analytics.'],
]) {
  test(name + ' does not contradict the explicit no-work degree route', () => {
    const result = classify(job(body))
    assert.equal(result.resolved.jobType, 'Full-time Fresher')
    assert.deepEqual(result.sourceQualityIssues, [])
  })
}

test('a definite independent professional-work floor retains the existing Experienced policy', () => {
  const result = classify(job(route + '\n2+ years of professional project-management experience.'))
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.deepEqual(result.sourceQualityIssues, [])
})

test('excluding academic experience does not negate a separate professional-work floor', () => {
  const result = classify(job(route + '\n2+ years of professional project-management experience, where academic project experience is excluded.'))
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.deepEqual(result.sourceQualityIssues, [])
})

test('an authoritative native prior-work floor retains the existing Experienced policy', () => {
  const result = classify({ ...job(route + '\n' + relatedHistory), sourceExperienceRequired: '5+ years' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.deepEqual(result.sourceQualityIssues, [])
})

test('an explicit own Contract arrangement remains identifiable despite unclear work eligibility', () => {
  const result = classify({ ...job(route + '\n' + relatedHistory), sourceEmploymentType: 'Contract' })
  assert.equal(result.resolved.jobType, 'Contract')
})
