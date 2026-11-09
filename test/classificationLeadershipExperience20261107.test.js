import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const classify = (job, label = 'Full-time Fresher') => resolvePostScrapeClassification(job, {
  modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(value => [value, value === label ? .97 : .01])),
}, { now: new Date('2026-11-07T00:00:00Z'), mode: 'policy' })

test('a zero-year leadership range does not replace the separate overall work requirement', () => {
  const result = classify({ title: 'Service Management Manager', sourceDescription:
    'Manages the efforts of professional Service Management team. Monitors team performance and outcomes.\nYou will be successful in this role if you have:\nAny degree and 8 years\u2019 relevant experience OR equivalent combination of education and relevant experience 0-2 years\u2019 leadership experience' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 8)
})

test('a people-management subset does not turn experienced technical managers into freshers', () => {
  for (const years of [5, 7]) {
    const result = classify({ title: 'Technical Support Manager', sourceEmploymentType: 'Full-time', sourceDescription:
      `Manages exempt individual contributors and/or supervisors. Has accountability for results of a major program in terms of cost, direction and people management.\nWhat you need to bring. First level university degree or equivalent experience required. May have advanced university degree. Typically ${years} or more years of related work experience, including 0 -2 years of people management experience. Strong leadership skills, including coaching, team-building, and conflict resolution.` })
    assert.equal(result.resolved.jobType, 'Full-time Experienced', String(years))
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, years, String(years))
  }
})

test('zero leadership tenure alone does not assert zero overall professional experience', () => {
  const result = classify({ title: 'Service Team Coordinator', sourceEmploymentType: 'Full-time', sourceDescription:
    'Coordinate service delivery. Qualifications: Degree. 0-2 years of leadership experience.' })
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
})

test('positive decimal leadership tenure remains a professional work requirement in each source field', () => {
  for (const years of ['1.0', '2.0', '10.0']) {
    const requirement = `${years} years of leadership experience`
    for (const fields of [
      { sourceExperienceRequired: requirement },
      { minimumQualification: requirement },
      { sourceDescription: `Required qualifications:\n${requirement}.` },
    ]) {
      const result = classify({ title: 'Service Coordinator', sourceEmploymentType: 'Full-time',
        sourceDescription: 'Coordinate service delivery. Degree required.', ...fields })
      assert.equal(result.resolved.jobType, 'Full-time Experienced', JSON.stringify(fields))
      assert.equal(result.resolved.employerExperienceProfile.minimumYears, Number(years), JSON.stringify(fields))
    }
  }
})

test('an exact decimal zero leadership subset still differs from overall work experience', () => {
  for (const zero of ['0.0', '0.00']) {
    const result = classify({ title: 'Service Management Manager', sourceEmploymentType: 'Full-time', sourceDescription:
      `Typically 7 or more years of related work experience, including ${zero}-2 years of people management experience.` })
    assert.equal(result.resolved.jobType, 'Full-time Experienced', zero)
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 7, zero)
  }
})

test('zero overall experience remains valid when leadership experience is separately preferred', () => {
  const result = classify({ title: 'Associate Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
    'Required qualifications: Degree. 0-2 years of relevant work experience.\nPreferred qualifications:\n3 years of leadership experience.' }, 'Full-time Experienced')
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
})

test('zero experience in a project-management occupation is still an entry route', () => {
  const result = classify({ title: 'Project Coordinator', sourceEmploymentType: 'Full-time', sourceDescription:
    'Support project planning under guidance. Required qualifications: Degree. 0-2 years of project management experience.' }, 'Full-time Experienced')
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
})

test('explicit contract and internship appointments retain their own employment category', () => {
  const sourceDescription = '8 years of relevant work experience, including 0-2 years of people management experience.'
  assert.equal(classify({ title: 'Support Manager', sourceEmploymentType: 'Contract', sourceDescription }).resolved.jobType, 'Contract')
  assert.equal(classify({ title: 'Research Intern', sourceEmploymentType: 'Internship', sourceDescription }).resolved.jobType, 'Intern')
})
