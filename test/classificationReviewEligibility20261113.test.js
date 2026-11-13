import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const cases = JSON.parse(readFileSync(new URL('./test-data/classificationReviewEligibility20261113.json', import.meta.url)))
const now = new Date('2026-11-13T03:05:48Z')
const predict = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(label => [label, label === modelLabel ? .97 : .01])) })

for (const { name, job, prediction, want } of cases) test(`reviewed eligibility: ${name}`, () => {
  const result = resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, want)
  assert(!result.sourceQualityIssues.includes('conflicting_role_eligibility'))
})

for (const [title, description, want] of [
  ['Trainer for Freshers', 'Train fresh graduates on software development.', 'Full-time Experienced'],
  ['Recruiter for Freshers', 'Recruit fresh graduates for client openings.', 'Full-time Experienced'],
  ['Fresher Engineer', 'Required qualifications:\n0-3 years of experience. Prior professional work experience is mandatory.', 'Unspecified'],
  ['Apprentice', 'Required qualifications:\nMinimum 1 year of mortgage experience.', 'Full-time Experienced'],
  ['Contract Administration Specialist', 'Administer customer contracts and coordinate delivery.', 'Full-time Experienced'],
]) test(`eligibility ownership control: ${title}`, () => {
  const result = resolvePostScrapeClassification({ title, sourceDescription: description
    + ' Collaborate with internal stakeholders, document progress, resolve operational issues and coordinate delivery across teams.' }, predict('Full-time Experienced'), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, want)
})
