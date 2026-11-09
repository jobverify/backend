import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildClassificationInput } from '../src/services/jobClassificationPolicy.js'
import { collectRecruitmentFacts } from '../src/services/jobRecruitmentPolicy.js'
import { resolvePostScrapeClassification, sourceGuardedClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationMandatoryHistoryBinding20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher']
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries([...labels, 'Intern', 'Contract'].map(label => [label, label === modelLabel ? .97 : .01])) })
const classify = (job, label) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

for (const row of fixture.cases) {
  const job = { title: row.title, originalTitle: row.title, company: row.company, source: row.source,
    sourceUrl: row.sourceUrl, applyUrl: row.applyUrl, sourceDescription: row.originalText, ...row.sourceFields }
  test('complete mandatory-history source and literal evidence remain pinned/' + row.id, () => {
    assert.equal(createHash('sha256').update(row.originalText).digest('hex'), row.originalTextSha256)
    for (const quote of row.evidenceQuotes) assert.ok(row.originalText.includes(quote), quote)
  })
  if (!row.expected) {
    test('unresolved industry background is not paired with a distant must-have heading/' + row.id, () => {
      assert.equal(row.manualVerdict, 'conflicting_source')
      const facts = collectRecruitmentFacts(buildClassificationInput(job, { now }))
      assert.equal(facts.requiredProfessionalExperience, undefined)
    })
    continue
  }
  test('complete source-only policy retains independently confirmed fresher eligibility/' + row.id, () => {
    assert.equal(sourceGuardedClassification(job, { now, mode: 'policy' }).resolved.jobType, row.expected)
  })
  for (const label of labels) {
    test('complete source zero-work eligibility survives nearby requirement wording/' + row.id + '/' + label, () => {
      const result = classify(job, label)
      assert.equal(result.resolved.jobType, row.expected)
      assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
      const facts = collectRecruitmentFacts(buildClassificationInput(job, { now }))
      assert.equal(facts.requiredProfessionalExperience, undefined)
      assert.equal(facts.requiredPriorHistory, undefined)
    })
  }
}

for (const [name, sourceDescription, expected] of [
  ['own closed-zero duration', 'Required qualifications:\nApplicants must have 0 to 2 years of professional work experience.', 'Full-time Fresher'],
  ['own zero-month duration', 'Required qualifications:\nCandidates must have 0 to 6 months of relevant work experience.', 'Full-time Fresher'],
  ['own word-zero duration', 'Required qualifications:\nYou must have zero to two years of professional work experience.', 'Full-time Fresher'],
  ['own word-zero single duration', 'Required qualifications:\nYou must have zero years of professional work experience.', 'Full-time Fresher'],
  ['own zero-duration postfix requirement', 'Required qualifications:\n0 to 2 years of professional work experience is required.', 'Full-time Fresher'],
  ['combined heading with degree duration', "Education, Certifications, and Work Experience Required 3 + years bachelor's degree in commerce.\n0-6 months work experience only. Fresher is required.", 'Full-time Fresher'],
  ['master-only condition', 'Freshers can apply.\nMaster graduate candidates must have one year of work experience.', 'Full-time Fresher'],
  ['flattened master-only condition', 'Freshers and graduates from any stream are eligible to apply Master graduate candidates must have one year of work experience.', 'Full-time Fresher'],
  ['bachelor-only condition', 'Freshers can apply.\nBachelor graduate applicants must have one year of professional experience.', 'Full-time Fresher'],
  ['unrelated must-have skill', 'Industry experience is useful to our teams, and you must have good communication skills.', 'Full-time Fresher'],
  ['universal professional history', 'Required qualifications:\nAll applicants must have prior professional work experience.', 'Full-time Experienced'],
  ['universal positive duration', 'Required qualifications:\nApplicants must have 3 years of professional work experience.', 'Full-time Experienced'],
  ['direct professional history', 'Required qualifications:\nWork experience is required.', 'Full-time Experienced'],
  ['bare direct professional history', 'Required qualifications:\nProfessional work experience required.', 'Full-time Experienced'],
  ['separate universal condition after subset', 'Master graduate candidates must have one year of work experience.\nAll applicants must have prior professional work experience.', 'Full-time Experienced'],
  ['separate universal condition after zero', 'Applicants must have 0 to 2 years of work experience and all applicants must have prior professional work experience.', 'Full-time Experienced'],
  ['zero range after independent universal history', 'All applicants must have previous professional work experience.\nApplicants must have 0 to 2 years of work experience.', 'Full-time Experienced'],
  ['academic substitute for direct history', 'Work experience is required. Academic projects satisfy this requirement.', 'Full-time Fresher'],
]) {
  for (const label of labels) {
    test('mandatory history binds its own subject and duration/' + name + '/' + label, () => {
      const job = { title: 'Analyst', sourceEmploymentType: 'Full-time', sourceExperienceRequired: '0 to 2 years', sourceDescription }
      assert.equal(classify(job, label).resolved.jobType, expected)
    })
  }
}
