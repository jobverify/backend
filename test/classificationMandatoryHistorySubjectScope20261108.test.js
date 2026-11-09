import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationMandatoryHistorySubjectScope20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(label => [label, label === modelLabel ? .97 : .01])) })
const classify = (job, label) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

for (const row of fixture.cases) {
  for (const label of labels) {
    test('independent mandatory-history subject scope/' + row.name + '/' + label, () => {
      assert.equal(classify(row.job, label).resolved.jobType, row.expected)
    })
  }
}

for (const [name, condition, expected] of [
  ['separate positive academic duration', 'Applicants must have two years of academic project experience and prior professional work experience.', 'Full-time Experienced'],
  ['academic credit explicitly satisfies history', 'Applicants must have good communication skills and prior professional work experience. Academic projects satisfy this requirement.', 'Full-time Fresher'],
  ['academic credit allowed after history', 'Applicants must have prior professional work experience, which may include academic projects.', 'Full-time Fresher'],
  ['professional experience explicitly starts at zero', 'Applicants must have good communication skills and zero to two years of professional work experience.', 'Full-time Fresher'],
  ['direct own skills plus history', 'Good communication skills and prior professional work experience are mandatory for this role.', 'Full-time Experienced'],
  ['direct duty checks requirements', 'Responsibilities:\nCheck whether good communication skills and professional work experience are required for client vacancies.', 'Full-time Fresher'],
]) {
  for (const label of labels) {
    test('mandatory-history condition retains own subject and waiver/' + name + '/' + label, () => {
      const job = { title: 'Analyst', sourceEmploymentType: 'Full-time',
        sourceDescription: 'Required qualifications:\nExperience: 0 to 2+ years.\n' + condition }
      assert.equal(classify(job, label).resolved.jobType, expected)
    })
  }
}
