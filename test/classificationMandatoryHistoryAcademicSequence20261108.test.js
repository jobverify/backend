import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationMandatoryHistoryAcademicSequence20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(label => [label, label === modelLabel ? .97 : .01])) })
const classify = (job, label) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

for (const row of fixture.cases) {
  for (const label of labels) {
    test('independent academic sequence and explicit credit/' + row.name + '/' + label, () => {
      assert.equal(classify(row.job, label).resolved.jobType, row.expected)
    })
  }
}

for (const [name, condition, expected] of [
  ['three additive academic requirements', 'Applicants must have prior professional work experience and academic project experience and internship experience and coursework experience.', 'Full-time Experienced'],
  ['explicit can-be-used academic credit', 'Applicants must have prior professional work experience, and academic projects can be used to meet this experience requirement.', 'Full-time Fresher'],
  ['adjacent may-be-used credit', 'Applicants must have prior professional work experience. Academic projects may be used to meet this experience requirement.', 'Full-time Fresher'],
  ['negated academic credit', 'Applicants must have prior professional work experience. Academic projects may not be used to meet this experience requirement.', 'Full-time Experienced'],
]) {
  for (const label of labels) {
    test('academic requirement sequence retains relation and negation/' + name + '/' + label, () => {
      const job = { title: 'Analyst', sourceEmploymentType: 'Full-time',
        sourceDescription: 'Required qualifications:\nExperience: 0 to 2+ years.\n' + condition }
      assert.equal(classify(job, label).resolved.jobType, expected)
    })
  }
}
