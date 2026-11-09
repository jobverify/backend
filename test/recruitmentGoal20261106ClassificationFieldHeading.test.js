import test from 'node:test'
import assert from 'node:assert/strict'
import { postScrapeInput, resolvePostScrapeClassification, sourceGuardedClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-04T00:00:00Z')
const description = 'Responsibilities:\nBuild and test applications for customer services.\nRequirements:\nBasic technical knowledge and willingness to learn.'
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
const classify = job => resolvePostScrapeClassification(job, prediction, { mode: 'policy', now })

for (const sourceExperienceRequired of ['Fresher', 'Freshers', '0', '0 years', '0-6 months']) {
  test(`an employer's ${sourceExperienceRequired} field remains eligible after a requirements section`, () => {
    const job = { title: 'Fresher - BD & Sales', sourceDescription: description, sourceExperienceRequired }
    const original = structuredClone(job), input = postScrapeInput(job, { now })
    assert.ok(input.body.includes('Required professional experience:\n' + sourceExperienceRequired))
    const result = classify(job)
    assert.equal(result.resolved.jobType, 'Full-time Fresher')
    assert.equal(result.resolved.experienceProfile.minimumYears, 0)
    assert.equal(result.decisionSource, 'source_policy')
    assert.deepEqual(result.reviewReasons, [])
    assert.deepEqual(job, original)
    assert.equal(result.inputHash, input.inputHash)
  })
}

for (const requirement of [
  'Minimum 3 years of professional experience required.',
  'You must have prior professional experience in sales.',
  'Prior professional experience in sales is essential.',
  'No prior sales experience is required, but prior engineering experience is mandatory.',
]) {
  test(`a fresher field cannot erase the employer requirement: ${requirement}`, () => {
    const result = classify({ title: 'Fresher - BD & Sales', sourceExperienceRequired: 'Fresher',
      sourceDescription: description + '\n' + requirement })
    assert.equal(result.resolved.jobType, 'Unspecified')
    assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
  })
}

test('positive numeric experience in the field still conflicts with a fresher title', () => {
  const result = classify({ title: 'Fresher - BD & Sales', sourceDescription: description,
    sourceExperienceRequired: '3 years' })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3)
  assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
})

test('a multiline field retains its mandatory nonnumeric work experience clause', () => {
  const result = classify({ title: 'Fresher - BD & Sales', sourceDescription: description,
    sourceExperienceRequired: 'Fresher\nYou must demonstrate prior professional experience in sales.' })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
})

for (const sourceExperienceRequired of [
  'Experienced',
  'Fresher\nPrior sales experience is mandatory.',
]) {
  test(`positive employer experience values survive removal of the field heading: ${sourceExperienceRequired}`, () => {
    const result = classify({ title: 'Fresher - BD & Sales', sourceDescription: description, sourceExperienceRequired })
    assert.equal(result.resolved.jobType, 'Unspecified')
    assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
  })
}

for (const clause of [
  'No prior sales experience is required.',
  'Prior sales experience is not mandatory.',
  'Prior sales experience is preferred.',
  'Freshers and experienced candidates are welcome.',
]) {
  test(`optional or waived prior sales experience does not conflict: ${clause}`, () => {
    const result = classify({ title: 'Fresher - BD & Sales', sourceDescription: description + '\n' + clause,
      sourceExperienceRequired: 'Fresher' })
    assert.equal(result.resolved.jobType, 'Full-time Fresher')
    assert.deepEqual(result.reviewReasons, [])
  })
}

test('a standalone experience heading cannot establish required work experience by itself', () => {
  const result = sourceGuardedClassification({ title: 'Software Engineer',
    sourceDescription: description + '\nRequired professional experience:' }, { mode: 'policy', now })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.equal(result.resolved.experienceProfile.minimumYears, null)
})
