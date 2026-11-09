import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const base = 'Required qualifications:\nExperience: 0 to 2+ years.\nWork experience is required.\n'
const source = base + 'Academic projects satisfy this requirement only if applicants have held a paid position in background verification.'
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(type => [type, type === modelLabel ? .97 : .01])) })
for (const label of labels) {
  for (const sourceExperienceRequired of [null, '0 to 2 years']) {
    test('academic allowance retains paid-position prerequisite/' + sourceExperienceRequired + '/' + label, () => {
      const result = resolvePostScrapeClassification({ title: 'Background Verification Analyst', sourceEmploymentType: 'Full-time',
        sourceExperienceRequired, sourceDescription: source }, prediction(label), { now, mode: 'policy' })
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.ok(result.resolved.experienceProfile.minimumYears > 0)
    })
  }
  for (const [name, suffix] of [
    ['unconditional academic credit', 'Academic projects satisfy this requirement.'],
    ['portfolio condition without work history', 'Academic projects satisfy this requirement only if applicants provide a portfolio.'],
  ]) {
    test(name + '/' + label, () => {
      const result = resolvePostScrapeClassification({ title: 'Background Verification Analyst', sourceEmploymentType: 'Full-time',
        sourceDescription: base + suffix }, prediction(label), { now, mode: 'policy' })
      assert.equal(result.resolved.jobType, 'Full-time Fresher')
    })
  }
}

