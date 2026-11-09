import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationMandatoryHistoryParallelRequirements20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(label => [label, label === modelLabel ? .97 : .01])) })
const classify = (job, label) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

for (const row of fixture.cases) {
  for (const label of labels) {
    test('independent mandatory parallel requirements/' + row.name + '/' + label, () => {
      assert.equal(classify(row.job, label).resolved.jobType, row.expected)
    })
  }
}

for (const [name, condition, expected] of [
  ['unquantified parallel academic history', 'Applicants must have prior professional work experience and academic project experience.', 'Full-time Experienced'],
  ['direct required parallel academic history', 'Prior professional work experience and academic project experience are required.', 'Full-time Experienced'],
  ['parallel academic history before another skill', 'Applicants must have prior professional work experience and zero to two years of academic project experience and good communication skills.', 'Full-time Experienced'],
  ['parallel history with explicit adjacent substitution', 'Applicants must have prior professional work experience and zero to two years of academic project experience. Academic projects satisfy this requirement.', 'Full-time Fresher'],
  ['academic alternative instead of work', 'Applicants must have academic or professional work experience.', 'Full-time Fresher'],
  ['explicit academic acceptance after work', 'Applicants must have prior professional work experience, and academic project experience is accepted for this requirement.', 'Full-time Fresher'],
]) {
  for (const label of labels) {
    test('parallel history preserves explicit work and credit/' + name + '/' + label, () => {
      const job = { title: 'Analyst', sourceEmploymentType: 'Full-time',
        sourceDescription: 'Required qualifications:\nExperience: 0 to 2+ years.\n' + condition }
      assert.equal(classify(job, label).resolved.jobType, expected)
    })
  }
}
