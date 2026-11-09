import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { sourceGuardedClassification, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationDoctoralZeroRoutes20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const prediction = label => ({ modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(type => [type, type === label ? .97 : .01])) })
const classify = (job, label) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })
const jobFor = row => ({ title: row.title, originalTitle: row.title, company: row.company, source: row.source,
  sourceUrl: row.sourceUrl, applyUrl: row.applyUrl, sourceDescription: row.originalText, ...row.sourceFields })
const routes = "Minimum 5 years of related experience with a Bachelors degree; or 3 years and a Master's degree; or a PhD without experience"
const own = sourceDescription => ({ title: 'Systems Engineer', sourceEmploymentType: 'Full-time', sourceDescription })
const body = 'Background and Experience:\n' + routes

for (const row of fixture.cases) {
  test('complete doctoral-route original remains pinned ' + row.id, () => {
    assert.equal(createHash('sha256').update(row.originalText).digest('hex'), row.originalTextSha256)
    assert.ok(row.originalText.includes('or a PhD without experience'))
  })
  for (const label of labels) {
    test('explicit doctoral zero-history route ' + row.id + '/' + label, () => {
      const result = classify(jobFor(row), label)
      assert.equal(result.resolved.jobType, 'Full-time Fresher')
      assert.equal(result.resolved.experienceProfile.minimumYears, 0)
      assert.equal(result.resolved.experienceProfile.maximumYears, 0)
      assert.equal(result.resolved.employerExperienceProfile.minimumYears, row.baselineEmployerProfile.minimumYears)
      assert.deepEqual(result.resolved.employerExperienceProfile, row.baselineEmployerProfile)
      assert.deepEqual(result.sourceQualityIssues, [])
      assert.equal(result.decisionSource, 'source_policy')
    })
  }
  test('doctoral route is source-only eligibility ' + row.id, () => {
    assert.equal(sourceGuardedClassification(jobFor(row), { now, mode: 'policy' }).resolved.jobType, 'Full-time Fresher')
  })
}

for (const label of labels) {
  for (const [name, sourceDescription, expected] of [
    ['own three credential branches', body, 'Full-time Fresher'],
    ['ordinary qualification heading', 'Required qualifications:\n' + routes, 'Full-time Fresher'],
    ['all branches require work', body.replace('without experience', 'with 2 years of professional work experience'), 'Full-time Experienced'],
    ['negated doctoral eligibility', body + ' are not eligible.', 'Full-time Experienced'],
    ['skill-specific absence', body.replace('without experience', 'without experience in Python'), 'Full-time Experienced'],
    ['bare doctoral credential', body.replace('PhD without experience', 'PhD'), 'Full-time Experienced'],
    ['preferred section retains scope', 'Required qualifications:\n5 years of professional work experience.\nPreferred qualifications:\n' + body, 'Full-time Experienced'],
    ['third-party recruitment duty', 'Required qualifications:\n5 years of professional work experience.\nResponsibilities:\nRecruit applicants with ' + routes, 'Full-time Experienced'],
    ['separate professional history', body + '.\nAll applicants must have 2 years of professional work experience.', 'Full-time Experienced'],
    ['preceding universal history', 'All applicants must have 2 years of professional work experience.\n' + body, 'Full-time Experienced'],
    ['separate employment requirement', body + '.\nPrevious employment in systems engineering is required.', 'Full-time Experienced'],
    ['same sentence universal numeric floor', body + ', and a minimum of 2 years of professional work experience for all applicants.', 'Full-time Experienced'],
    ['conditional prior employment', body + ' only if applicants have previous employment in systems engineering.', 'Full-time Experienced'],
    ['unresolved separate related-history floor', body + '.\nRequired qualifications:\n2 years of related systems engineering experience.', 'Unspecified'],
  ]) {
    test('doctoral route scope ' + name + '/' + label, () => {
      assert.equal(classify(own(sourceDescription), label).resolved.jobType, expected)
    })
  }
  for (const sourceExperienceRequired of ['5 years', '3 years of professional work experience']) {
    test('independent positive native history ' + sourceExperienceRequired + '/' + label, () => {
      assert.equal(classify({ ...own(body), sourceExperienceRequired }, label).resolved.jobType, 'Full-time Experienced')
    })
  }
  for (const [sourceEmploymentType, expected] of [['Contract', 'Contract'], ['Internship', 'Intern']]) {
    test('doctoral route preserves own arrangement ' + sourceEmploymentType + '/' + label, () => {
      assert.equal(classify({ ...own(body), sourceEmploymentType }, label).resolved.jobType, expected)
    })
  }
}
