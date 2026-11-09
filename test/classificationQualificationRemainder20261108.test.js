import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const routes = [
  ['doctoral', "Background and Experience:\nMinimum 5 years of related experience with a Bachelors degree; or 3 years and a Master's degree; or a PhD without experience"],
  ['accountancy', 'Qualification/Experience:\nQualified CA Fresher or semi-qualified CA with minimum 4 years of relevant experience'],
]
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(type => [type, type === modelLabel ? .97 : .01])) })
const classify = (sourceDescription, label, sourceExperienceRequired = null) =>
  resolvePostScrapeClassification({ title: 'Systems Analyst', sourceEmploymentType: 'Full-time', sourceExperienceRequired,
    sourceDescription }, prediction(label), { now, mode: 'policy' })
for (const [name, route] of routes) {
  for (const label of labels) {
    for (const [suffixName, suffix] of [
      ['plain employment coordination', ' and previous employment in systems engineering is required for all applicants.'],
      ['comma employment coordination', ', and previous employment in systems engineering is required for all applicants.'],
      ['plain paid-position coordination', ' and applicants must have held a paid position in systems engineering.'],
    ]) {
      test('qualification remainder ' + name + '/' + suffixName + '/' + label, () => {
        const result = classify(route + suffix, label)
        assert.equal(result.resolved.jobType, 'Full-time Experienced')
        assert.ok(result.resolved.experienceProfile.minimumYears > 0)
      })
    }
    test('unconditional qualification alternative remains valid ' + name + '/' + label, () => {
      assert.equal(classify(route, label).resolved.jobType, 'Full-time Fresher')
    })
    test('native zero retains the independent qualification remainder ' + name + '/' + label, () => {
      const result = classify(route + ' and previous employment in systems engineering is required for all applicants.',
        label, '0 to 2 years')
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
    })
  }
}

