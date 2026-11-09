import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { sourceGuardedClassification, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationExplicitQualificationRoutes20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const prediction = label => ({ modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract'].map(type => [type, type === label ? .97 : .01])) })
const jobFor = row => ({ title: row.title, originalTitle: row.title, company: row.company, source: row.source,
  sourceUrl: row.sourceUrl, applyUrl: row.applyUrl, sourceDescription: row.originalText, ...row.sourceFields })
const classify = (job, label = 'Full-time Experienced') => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

for (const row of fixture.cases) {
  test('complete employer original is pinned: ' + row.id, () => {
    assert.equal(createHash('sha256').update(row.originalText).digest('hex'), row.originalTextSha256)
  })
  for (const label of ['Full-time Experienced', 'Full-time Fresher']) {
    test('explicit qualification route permits freshers under either model: ' + row.id + '/' + label, () => {
      const result = classify(jobFor(row), label)
      assert.equal(result.resolved.jobType, 'Full-time Fresher')
      assert.equal(result.resolved.experienceProfile.minimumYears, 0)
      assert.equal(result.resolved.experienceProfile.maximumYears, 0)
      assert.equal(result.resolved.employerExperienceProfile.minimumYears, row.rawAlternateMinimumYears)
      assert.deepEqual(result.sourceQualityIssues, [])
      assert.equal(result.decisionSource, 'source_policy')
      if (row.id === '6aecc53809828b3c88fa761d') assert.equal(result.resolved.experienceProfile.preferredMinimumYears, 6)
    })
  }
}

const bodies = [
  "Minimum required Experience: No prior experience required with Bachelor's Degree OR minimum 4 years of experience with Vocational Education.",
  'Qualifications & Experience:\nQualified CMA/CA - Fresher\nInter CMA/Inter CA/MBA with 2+ years of costing and accounting experience\nB.com/M.com, or a relevant field and/or 4+ year\u2019s of costing and accounting experience is required.',
  'Qualification/Experience:\nQualified CA Fresher or semi-qualified CA with minimum 4 years of relevant experience.',
]
const job = body => ({ title: 'Financial Systems Analyst', sourceEmploymentType: 'Full-time', sourceDescription: body })

for (const [index, body] of bodies.entries()) {
  test('positive native history remains independent of qualification route ' + index, () => {
    assert.equal(classify({ ...job(body), sourceExperienceRequired: '5 years of professional work experience' }).resolved.jobType, 'Full-time Experienced')
  })
  test('separate universal professional work history is retained ' + index, () => {
    for (const requirement of ['All applicants must have 3 years of professional work experience.',
      'Previous employment in accounting is required.',
      'Required qualifications:\n3+ years of professional accounting experience.']) {
      for (const text of [requirement + '\n' + body, body + '\n' + requirement]) {
        assert.equal(classify(job(text)).resolved.jobType, 'Full-time Experienced', text)
      }
    }
  })
  test('a separate related-history floor with unresolved academic scope requires review ' + index, () => {
    const result = classify(job(body + '\nRequired qualifications:\n2+ years of related accounting experience.'))
    assert.equal(result.resolved.jobType, 'Unspecified')
    assert.ok(result.sourceQualityIssues.includes('conflicting_role_eligibility'))
  })
  test('qualification route does not override own finite engagement ' + index, () => {
    assert.equal(classify({ ...job(body), sourceEmploymentType: 'Contract' }).resolved.jobType, 'Contract')
    assert.equal(classify({ ...job(body), title: 'Finance Intern', sourceEmploymentType: 'Internship' }).resolved.jobType, 'Intern')
  })
}

test('bare or preferred education does not establish a zero-work route', () => {
  for (const body of [
    'Required qualifications:\nQualified CA or semi-qualified CA with minimum 4 years of relevant experience.',
    "Required qualifications:\nBachelor's Degree OR Vocational Education.\nMinimum 4 years of professional experience.",
    'Required qualifications:\n4 years of professional accounting experience.\nPreferred qualifications:\nQualified CA Fresher or semi-qualified CA with minimum 4 years of relevant experience.',
  ]) assert.equal(classify(job(body)).resolved.jobType, 'Full-time Experienced', body)
})

test('third-party credential routes are duties rather than applicant eligibility', () => {
  for (const verb of ['Recruit', 'Train', 'Advise']) {
    const body = 'Required qualifications:\n5 years of professional accounting experience.\nResponsibilities:\n'
      + verb + ' qualified CA freshers or semi-qualified CA with minimum 4 years of relevant experience.'
    assert.equal(classify(job(body)).resolved.jobType, 'Full-time Experienced', verb)
  }
})

test('negated fresher routes do not waive professional history', () => {
  for (const body of [
    'Qualifications & Experience:\nQualified CA Freshers are not eligible; semi-qualified CA with minimum 4 years of professional experience are eligible.',
    "Minimum required Experience: No prior experience required with Bachelor's Degree is not applicable. Minimum 4 years of professional experience is required.",
  ]) assert.equal(classify(job(body)).resolved.jobType, 'Full-time Experienced', body)
})

test('conditional credential routes retain their prior-employment condition', () => {
  const body = bodies[2] + '\nCandidates with the fresher qualification may apply only with previous employment in accounting.'
  assert.equal(classify(job(body)).resolved.jobType, 'Full-time Experienced')
})

test('a route-only zero-work result is source derived without model inference', () => {
  for (const body of bodies) assert.equal(sourceGuardedClassification(job(body), { now, mode: 'policy' }).resolved.jobType, 'Full-time Fresher')
})

const credentialRoute = 'Qualification/Experience:\nQualified CA Fresher or semi-qualified CA with minimum 4 years of relevant experience'
for (const label of ['Full-time Experienced', 'Full-time Fresher']) {
  for (const [name, sourceDescription] of [
    ['same sentence after comma', credentialRoute + ', and a minimum of 2 years of professional accounting experience for all applicants.'],
    ['same sentence without comma', credentialRoute + ' and a minimum of 2 years of professional accounting experience for all applicants.'],
    ['sibling education branch', 'Qualifications & Experience:\nQualified CMA/CA - Fresher\nInter CA with minimum 4 years of relevant experience and a minimum of 2 years of professional accounting experience for all applicants.'],
  ]) {
    test('a universal professional floor survives qualification scope: ' + name + '/' + label, () => {
      const result = classify(job(sourceDescription), label)
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.ok(result.resolved.experienceProfile.minimumYears > 0)
    })
  }
  test('professional years restricted to the alternate credential route stay optional: ' + label, () => {
    const sourceDescription = 'Qualification/Experience:\nQualified CA Fresher or semi-qualified CA with minimum 4 years of professional accounting experience.'
    assert.equal(classify(job(sourceDescription), label).resolved.jobType, 'Full-time Fresher')
  })
}
