import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationMandatoryHistoryCoordination20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(label => [label, label === modelLabel ? .97 : .01])) })
const classify = (job, label) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

for (const row of fixture.cases) {
  for (const label of labels) {
    test('independent mandatory-history coordination/' + row.name + '/' + label, () => {
      assert.equal(classify(row.job, label).resolved.jobType, row.expected)
    })
  }
}

for (const [name, condition] of [
  ['coordinated zero-work duration', 'Applicants must have strong communication skills and 0 to 2 years of professional work experience.'],
  ['coordinated word-zero work duration', 'Applicants must have good communication skills and zero years of professional work experience.'],
  ['coordinated master subset', 'Master graduate candidates must have good communication skills and prior professional work experience.'],
  ['coordinated third-party duty', 'Responsibilities:\nVerify that all applicants must have good communication skills and prior professional work experience for our clients.'],
  ['coordinated academic substitute', 'Applicants must have good communication skills and work experience. Academic projects satisfy this requirement.'],
  ['postfix coordinated zero-work range', 'Strong communication skills and 0 to 2 years of professional work experience are required.'],
]) {
  for (const label of labels) {
    test('coordination retains the actual eligibility scope/' + name + '/' + label, () => {
      const job = { title: 'Analyst', sourceEmploymentType: 'Full-time', sourceExperienceRequired: '0 to 2 years',
        sourceDescription: 'Required qualifications:\nExperience: 0 to 2+ years.\n' + condition }
      assert.equal(classify(job, label).resolved.jobType, 'Full-time Fresher')
    })
  }
}
