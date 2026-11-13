import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const cases = JSON.parse(readFileSync(new URL('./test-data/classificationReviewExperience20261113.json', import.meta.url)))
const now = new Date('2026-11-13T03:05:48Z')
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }

for (const { name, job, want } of cases) test(`reviewed employer experience: ${name}`, () => {
  const before = structuredClone(job)
  const hash = postScrapeInput(job, { now }).inputHash
  const result = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, want.jobType)
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, want.minimumYears)
  assert.equal(result.resolved.employerExperienceProfile.maximumYears, want.maximumYears)
  assert.deepEqual(job, before)
  assert.equal(postScrapeInput(job, { now }).inputHash, hash)
})
