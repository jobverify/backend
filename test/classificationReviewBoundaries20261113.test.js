import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-13T03:05:48Z')
const predict = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(label => [label, label === modelLabel ? .97 : .01])) })

for (const [name, title, description, model, minimum] of [
  ['age followed by work history', 'Engineer', 'Required qualifications: Age limit 30 and minimum 3 years of professional experience. Build and maintain enterprise software.', 'Intern', 3],
  ['programme management tenure', 'Programme Specialist', 'Required qualifications: Minimum 3 years programme management experience. Coordinate public programmes and manage funding reports.', 'Intern', 3],
  ['training programme management tenure', 'Programme Specialist', 'Required qualifications: At least 3 years training programme management experience. Coordinate public programmes and manage funding reports.', 'Intern', 3],
  ['programme evaluation tenure', 'Programme Specialist', 'Required qualifications: Minimum 3 years programme evaluation experience. Evaluate public programmes and prepare independent impact reports.', 'Intern', 3],
  ['conditional closure footer', 'Engineer', 'Required qualifications: Minimum 3 years of professional experience. Build production software. If this position is closed, please explore our other career opportunities.', 'Intern', 3],
  ['scholarship administration vacancy', 'Scholarship Assistant', 'Administer the scholarship scheme, verify applications, and coordinate scholarship payments. Required qualifications: Minimum 3 years of professional experience.', 'Intern', 3],
  ['students eligibility belongs to students', 'Mentor', 'We are hiring mentors for our training programme (freshers). Guide students on interview technique and provide careers advice.', 'Full-time Experienced', null],
]) test(`review boundary: ${name}`, () => {
  const result = resolvePostScrapeClassification({ title, sourceDescription: description }, predict(model), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.experienceProfile.minimumYears, minimum)
  assert.deepEqual(result.sourceQualityIssues, [])
})

test('minimum apprenticeship length does not override an explicit prior-experience waiver', () => {
  const result = resolvePostScrapeClassification({ title: 'Apprentice', sourceDescription:
    'This is a minimum 12 months apprenticeship programme. No prior experience is required. Learn software development with experienced mentors.' }, predict('Full-time Experienced'), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.experienceProfile.minimumYears, 0)
})
