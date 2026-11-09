import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { extractJobFilterSignals } from '../src/utils/jobFilterSignals.js'
import { resolvePostScrapeClassification, sourceGuardedClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/classificationUpperOpenRange20261108.json', import.meta.url)))
const scopeReview = JSON.parse(readFileSync(new URL('./fixtures/classificationUpperOpenScopeReview20261108.json', import.meta.url)))
const now = new Date('2026-11-07T12:00:00Z')
const prediction = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract'].map(x => [x, x === modelLabel ? .97 : .01])) })
const classify = (job, label = 'Full-time Experienced') => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })
const job = sourceDescription => ({ title: 'Background Verification Analyst', sourceEmploymentType: 'Full-time', sourceDescription })
const body = 'Required qualifications:\nExperience: Background Verification Operations (0 To 2+ years)'

for (const row of scopeReview.cases) {
  for (const label of ['Full-time Experienced', 'Full-time Fresher']) {
    test('independent scope review ' + row.name + '/' + label, () => {
      assert.equal(classify(row.job, label).resolved.jobType, row.expected, row.rationale || row.name)
    })
  }
}

for (const [name, sourceDescription, expected] of [
  ['own postfix experience range', 'Required qualifications:\nApplicants must have 0 to 2+ years of background verification experience.', 'Full-time Fresher'],
  ['company history after fresher eligibility', 'Required qualifications:\nFreshers can apply.\nAbout us:\nOur company has 3 to 5+ years of experience.', 'Full-time Fresher'],
  ['children with lived experience', 'Required qualifications:\nFreshers can apply.\nResponsibilities:\nSupport parents of children aged 3 to 5+ years with lived experience of disability.', 'Full-time Fresher'],
  ['future vesting with firm', 'Required qualifications:\nFreshers can apply.\nBenefits:\nYour pension contributions vest after 3 to 5+ years of experience with the firm.', 'Full-time Fresher'],
  ['unrelated academic supplement', body + '\nWork experience is required.\nAcademic projects can support a separate research skill.', 'Full-time Experienced'],
]) {
  for (const label of ['Full-time Experienced', 'Full-time Fresher']) {
    test('experience ownership ' + name + '/' + label, () => {
      assert.equal(classify(job(sourceDescription), label).resolved.jobType, expected)
    })
  }
}

for (const row of fixture.cases) {
  const sourceJob = { title: row.title, originalTitle: row.title, company: row.company, source: row.source,
    sourceUrl: row.sourceUrl, applyUrl: row.applyUrl, sourceDescription: row.originalText, ...row.sourceFields }
  test('complete employer original remains pinned ' + row.id, () => {
    assert.equal(createHash('sha256').update(row.originalText).digest('hex'), row.originalTextSha256)
    assert.ok(row.originalText.includes('Background Verification Operations (0 To 2+ years)'))
  })
  for (const label of ['Full-time Experienced', 'Full-time Fresher']) {
    test('zero-year lower bound survives the upper plus ' + row.id + '/' + label, () => {
      const result = classify(sourceJob, label)
      assert.equal(result.resolved.jobType, 'Full-time Fresher')
      assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
      assert.equal(result.resolved.employerExperienceProfile.maximumYears, null)
      assert.equal(result.resolved.employerExperienceProfile.isOpenEnded, true)
      assert.match(result.resolved.employerExperienceProfile.evidence, /0.*2\s*\+/)
      assert.deepEqual(result.sourceQualityIssues, [])
    })
  }
  test('source-only policy retains zero-year eligibility ' + row.id, () => {
    assert.equal(sourceGuardedClassification(sourceJob, { now, mode: 'policy' }).resolved.jobType, 'Full-time Fresher')
  })
}

for (const [range, minimumYears] of [
  ['0 To 2+ years', 0], ['0-2+ yrs', 0], ['1 to 3+ years', 1],
  ['0.5 to 2+ years', .5], ['0 to 6+ months', 0], ['6 to 12+ months', .5],
]) {
  for (const field of ['experienceRequired', 'description']) {
    test('upper-open range keeps its own lower bound ' + range + '/' + field, () => {
      const result = extractJobFilterSignals({ title: 'Analyst', [field]: field === 'description' ? 'Required experience: ' + range : range })
      assert.equal(result.experienceProfile.minimumYears, minimumYears)
      assert.equal(result.experienceProfile.maximumYears, null)
      assert.equal(result.experienceProfile.isOpenEnded, true)
    })
  }
}

for (const native of ['3 years', '3 years of professional work experience']) {
  test('positive native history takes precedence ' + native, () => {
    const result = classify({ ...job(body), sourceExperienceRequired: native })
    assert.equal(result.resolved.jobType, 'Full-time Experienced')
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3)
  })
}

for (const requirement of [
  'All applicants must have 3 years of professional work experience.',
  'Previous employment in background verification is required.',
]) {
  for (const position of ['before', 'after']) {
    test('independent universal employment history remains effective ' + requirement + '/' + position, () => {
      const sourceDescription = position === 'before' ? requirement + '\n' + body : body + '\n' + requirement
      assert.notEqual(classify(job(sourceDescription)).resolved.jobType, 'Full-time Fresher')
    })
  }
}

test('preferred zero range cannot waive required professional work', () => {
  assert.equal(classify(job('Required qualifications:\n5 years of professional work experience.\nPreferred qualifications:\n' + body)).resolved.jobType, 'Full-time Experienced')
})

test('native zero range does not waive a separate universal employment condition', () => {
  for (const sourceExperienceRequired of ['0 To 2+ years', '0 to 2 years']) {
    const result = classify({ ...job(body + '\nPrevious employment in background verification is required.'), sourceExperienceRequired })
    assert.equal(result.resolved.jobType, 'Full-time Experienced')
    assert.equal(result.resolved.experienceBasis, 'experienced_role_default')
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
  }
})

test('optional, negated, academic and third-party history do not create a universal work floor', () => {
  for (const extra of [
    'Previous employment is not required.',
    'No prior professional experience required.',
    'No previous professional work experience is required.',
    'Previous employment is preferred.',
    'Previous academic research experience is required.',
    'Work experience is required and academic projects also qualify.',
    "Responsibilities:\nVerify candidates' previous employment records.",
  ]) assert.equal(classify(job(body + '\n' + extra)).resolved.jobType, 'Full-time Fresher', extra)
})

test('reversed upper-open ranges remain numerically unresolved', () => {
  for (const experienceRequired of ['2 to 0+ years', '12 to 6+ months']) {
    assert.equal(extractJobFilterSignals({ experienceRequired }).experienceProfile.minimumYears, null)
  }
})

test('own contract and internship retain their arrangement', () => {
  for (const [sourceEmploymentType, expected] of [['Contract', 'Contract'], ['Internship', 'Intern']]) {
    assert.equal(classify({ ...job(body), sourceEmploymentType }).resolved.jobType, expected)
  }
})

test('ordinary positive and closed ranges retain their established bounds', () => {
  for (const [experienceRequired, minimumYears, maximumYears, isOpenEnded] of [
    ['2+ years', 2, null, true], ['0 to 2 years', 0, 2, false], ['2 to 4 years', 2, 4, false],
  ]) {
    const result = extractJobFilterSignals({ experienceRequired }).experienceProfile
    assert.equal(result.minimumYears, minimumYears)
    assert.equal(result.maximumYears, maximumYears)
    assert.equal(result.isOpenEnded, isOpenEnded)
  }
})
