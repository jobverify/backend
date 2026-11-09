import test from 'node:test'
import assert from 'node:assert/strict'
import { createClassificationReport, recordClassificationDecision, aggregateClassificationSummaries } from '../classification/reporting.js'
import { postScrapeInput, sourceGuardedClassification, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js'

const now = new Date('2026-10-31T12:00:00Z')
const labels = ['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
const prediction = (modelLabel = 'Full-time Experienced') => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(labels.map(label => [label, label === modelLabel ? .97 : .01])) })
const description = 'Responsibilities: Build and test software for our customers. Requirements: Knowledge of JavaScript.'
const classify = (job, label) => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })
const rewritten = (sourceDescription, text, title = 'Software Engineer') => {
  const job = { title, sourceDescription, description: text }
  const inputHash = buildRewriteInput(job).inputHash
  return { ...job, sourceContentHash: inputHash, descriptionRewrite: { status: 'published', inputHash,
    policyVersion: 'reviewed-fixture', modelRevision: 'fixture', publishedAt: now.toISOString() } }
}

test('matching model fallback is distinct from a model/final conflict without changing legacy comparisons', () => {
  const parts = [0, 1].map(shard => ({ ...createClassificationReport(), shard, completed: 2, cached: 0, assigned: 2 }))
  const jobs = [
    { title: 'Software Engineer', sourceDescription: description },
    { title: 'Software Engineer', sourceDescription: 'Minimum 3 years of professional experience required.' },
    { title: 'Software Intern', sourceDescription: description },
    { title: 'Engineer', sourceDescription: 'ADVT./2026-27/09 Print Application. ADVT./2026-27/08 Print Application. ADVT./2026-27/07 Print Application.' },
  ]
  for (const [index, job] of jobs.entries()) {
    recordClassificationDecision(parts[Math.floor(index / 2)], { result: classify(job), prediction: prediction() })
  }
  const summary = aggregateClassificationSummaries(parts)
  assert.equal(summary.quality.modelAgreement, 1)
  assert.equal(summary.quality.modelDisagreement, 3)
  assert.equal(summary.quality.modelFinalAgreement, 2)
  assert.equal(summary.quality.modelFinalDisagreement, 2)
  assert.equal(summary.quality.modelFinalUnavailable, 0)
  assert.equal(summary.quality.modelFallback, 1)
  assert.equal(summary.quality.uncertain, 1)
})

test('missing model labels remain unavailable rather than inflating final-label agreement', () => {
  const summary = createClassificationReport()
  recordClassificationDecision(summary, { result: { resolved: { jobType: 'Intern' }, comparison: { agreement: null } } })
  assert.equal(summary.quality.modelFinalAgreement, 0)
  assert.equal(summary.quality.modelFinalDisagreement, 0)
  assert.equal(summary.quality.modelFinalUnavailable, 1)
})

test('a missing saved decision also counts as an unavailable final-label comparison', () => {
  const summary = createClassificationReport()
  recordClassificationDecision(summary, { prediction: prediction() })
  assert.equal(summary.quality.unavailable, 1)
  assert.equal(summary.quality.modelFinalUnavailable, 1)
})

test('legacy shard summaries retain unknown final-label comparison coverage', () => {
  const summary = aggregateClassificationSummaries([{ reportingVersion: 1, completed: 2, cached: 1,
    quality: { modelAgreement: 1, modelDisagreement: 2 } }])
  assert.equal(summary.quality.modelFinalUnavailable, 3)
  assert.equal(summary.quality.modelFinalAgreement, 0)
  assert.equal(summary.quality.modelFinalDisagreement, 0)
  assert.equal(summary.quality.modelDisagreement, 2)
})

test('explicit fresher vacancy titles establish eligibility before an experienced model fallback', () => {
  for (const title of ['Fresher Role', 'Testing Engineer (Fresher)', 'EbizON || Fresher Content Writer II Dehradun']) {
    const job = { title, sourceDescription: description }
    const result = classify(job)
    assert.equal(result.resolved.jobType, 'Full-time Fresher', title)
    assert.equal(result.decisionSource, 'source_policy', title)
    assert.equal(result.resolved.experienceProfile.minimumYears, 0, title)
    assert.equal(result.resolved.experienceProfile.hasExplicitExperience, false, title)
    assert.equal(result.inputHash, postScrapeInput(job, { now }).inputHash)
  }
})

test('mandatory professional experience conflicting with a fresher title remains uncertain', () => {
  for (const sourceDescription of [
    'Minimum 3 years of professional experience required. Build and test software.',
    'Requirements: You must have prior professional experience in software engineering.',
  ]) {
    const result = classify({ title: 'Testing Engineer (Fresher)', sourceDescription })
    assert.equal(result.resolved.jobType, 'Unspecified', sourceDescription)
    assert.equal(result.status, 'uncertain')
    assert.equal(result.reason, 'conflicting_role_eligibility')
    assert.ok(result.sourceQualityIssues.includes('conflicting_role_eligibility'))
    assert.equal(result.resolved.experienceProfile.minimumYears, null)
  }
})

test('welcoming both freshers and experienced applicants does not impose prior experience', () => {
  for (const [title, eligibility] of [
    ['Online For Telesales Executive Jobs (Freshers)', 'Eligibility: Freshers and experienced candidates are welcome.'],
    ['Customer Support Executive', 'Freshers or experienced applicants can apply.'],
  ]) {
    const result = classify({ title, sourceDescription: `${eligibility}\nGraduate or Undergraduate. Good communication skills in Hindi and English.` })
    assert.equal(result.resolved.jobType, 'Full-time Fresher', eligibility)
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
    assert.deepEqual(result.reviewReasons, [])
  }
})

test('mixed welcome wording cannot waive numeric, nonnumeric or conditional mandatory experience', () => {
  for (const sourceDescription of [
    'Freshers and experienced candidates are welcome. Minimum 3 years of professional experience required.',
    'Freshers and experienced candidates are welcome. You must have prior professional experience in recruitment.',
    'Freshers and experienced candidates are welcome but you must have prior professional experience in recruitment.',
    'Freshers and experienced candidates are eligible provided you have at least 2 years of experience.',
  ]) {
    const result = classify({ title: 'Telesales Executive (Freshers)', sourceDescription })
    assert.equal(result.resolved.jobType, 'Unspecified', sourceDescription)
    assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'), sourceDescription)
  }
})

for (const [heading, requirement] of [
  ['Required Qualifications:\n', 'you must demonstrate prior professional experience in sales'],
  ['Required Qualifications:\n', 'prior professional experience in sales is essential'],
  ['', 'you must demonstrate prior professional experience in sales'],
  ['', 'prior professional experience in sales is essential'],
]) test(`mixed welcome wording preserves ${heading ? 'qualification-section' : 'explicit'} requirements: ${requirement}`, () => {
  const result = classify({ title: 'Telesales Executive (Freshers)',
    sourceDescription: `${heading}Freshers and experienced candidates are welcome, but ${requirement}.` })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
})

test('a WNS-style fresher title with a six-year accounting requirement remains a source conflict', () => {
  const result = classify({ title: 'REF111473P-Assistant Manager - Record to Report- CA Fresher- US/UK Shift (5:30pm to 2:30am)- Pune',
    sourceDescription: 'Qualifications:\nBachelor degree in Accounting. Minimum 6 years of accounting experience in a performance-driven environment.' })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.ok(result.reviewReasons.includes('conflicting_role_eligibility'))
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 6)
})

test('training and recruiting freshers, or excluding them, does not establish applicant fresher eligibility', () => {
  for (const title of ['Trainer for Freshers', 'Fresher Recruitment Manager', 'Software Engineer - No Freshers',
    'Software Engineer - Freshers Not Eligible', 'Software Engineer - Freshers cannot apply', 'Software Engineer - Non Fresher',
    "Software Engineer - Freshers aren't eligible", 'Technical Instructor for Freshers', 'Tutors for Freshers',
    'Recruit Freshers - Talent Acquisition Specialist']) {
    assert.notEqual(sourceGuardedClassification({ title, sourceDescription: description }, { now }).resolved.jobType, 'Full-time Fresher', title)
  }
})

test('a fresher title preserves an explicit alternative to prior work experience', () => {
  const sourceDescription = 'Freshers or 2 years of relevant experience are welcome. Build software.'
  for (const title of ['Software Engineer', 'Fresher Software Engineer']) {
    const result = classify({ title, sourceDescription })
    assert.equal(result.resolved.jobType, 'Full-time Fresher', title)
    assert.equal(result.resolved.experienceProfile.minimumYears, 0)
    assert.equal(result.status, 'fallback')
    assert.deepEqual(result.sourceQualityIssues, [])
  }
})

test('lead generation is a task rather than a mandatory seniority requirement', () => {
  const result = classify({ title: 'Fresher Lead Generation Specialist', sourceDescription: description })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.deepEqual(result.sourceQualityIssues, [])
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
})

test('entry-level vacancies resolve as freshers before an experienced model fallback', () => {
  for (const title of ['Graduate Engineer Trainee', 'Trainee Associate Engineer', 'Entry Level Associate', 'Apprentice - Desktop Support',
    'Formal Verification Engineer - New College Graduate 2026', 'Graduate Engineer - AV/IT',
    'Trainee Resident Manager', 'Graduate Apprentice Trainee - Recruiter', 'Apprentice - Talent Acquisition']) {
    const result = classify({ title, sourceDescription: description })
    assert.equal(result.resolved.jobType, 'Full-time Fresher', title)
    assert.equal(result.decisionSource, 'source_policy', title)
    assert.equal(result.resolved.experienceProfile.minimumYears, 0, title)
    assert.equal(result.resolved.experienceBasis, 'entry_level_title', title)
    assert.equal(result.resolved.experienceProfile.hasExplicitExperience, false, title)
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, null, title)
    assert.deepEqual(result.reviewReasons, [], title)
  }
  for (const sourceDescription of ['Minimum 3 years of professional experience required.',
    'Requirements: You must have prior professional experience in software engineering.']) {
    const supported = classify({ title: 'Graduate Engineer Trainee', sourceDescription })
    assert.equal(supported.resolved.jobType, 'Full-time Experienced')
    assert.deepEqual(supported.reviewReasons, ['entry_level_title_with_required_experience'])
  }
})

test('recruiting and supervising entry-level applicants does not establish fresher eligibility', () => {
  for (const title of ['Graduate Recruitment Manager', 'Apprentice Training Officer', 'Trainee Program Manager',
    'Graduate Program Coordinator', 'Trainer for Apprentices', 'Supervisor of Trainees',
    'Senior Graduate Engineer', 'Engineer - No Trainees', 'Graduate']) {
    assert.notEqual(sourceGuardedClassification({ title, sourceDescription: description }, { now }).resolved.jobType, 'Full-time Fresher', title)
  }
})

test('entry-level title defaults preserve explicit internship, contract and cohort rules', () => {
  for (const sourceEmploymentType of ['Internship', 'Contract']) {
    const result = classify({ title: 'Graduate Engineer Trainee', sourceDescription: description, sourceEmploymentType })
    assert.equal(result.resolved.jobType, sourceEmploymentType === 'Internship' ? 'Intern' : 'Contract')
  }
  const pastCohort = classify({ title: 'Graduate Engineer', sourceDescription: 'Full-time recruitment for the 2025 batch.' })
  assert.equal(pastCohort.resolved.jobType, 'Full-time Experienced')
})

test('an ambiguous graduate title still requires review instead of inventing eligibility', () => {
  const result = classify({ title: 'Graduate', sourceDescription: description })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.experienceProfile.minimumYears, null)
  assert.deepEqual(result.reviewReasons, ['entry_level_title_with_experienced_prediction', 'sparse_role_description'])
})

test('degree duration does not manufacture conflicting professional experience for a fresher', () => {
  for (const education of ["3 + years bachelor's degree", "four-year bachelor's degree", "two years master's degree"]) {
    const result = classify({ title: 'Fresher Role', sourceDescription:
      `Education: ${education} in commerce. Experience: 0-6 months of work experience. Fresher is required.` })
    assert.equal(result.resolved.jobType, 'Full-time Fresher', education)
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0, education)
    assert.equal(result.resolved.employerExperienceProfile.maximumYears, .5, education)
    assert.deepEqual(result.sourceQualityIssues, [], education)
  }
})

test('explicit zero-experience eligibility for a fresher survives an older graduation cohort', () => {
  const result = classify({ title: 'Fresher Role', sourceExperienceRequired: '0-6 months',
    sourceDescription: "BCom graduates from the 2024/2025 batch only. Three years bachelor's degree. Fresher is required." })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
  assert.equal(result.resolved.experienceProfile.minimumYears, 0)
  assert.deepEqual(result.sourceQualityIssues, [])
})

test('education duration cleanup preserves professional experience following a degree', () => {
  const result = classify({ title: 'Engineer', sourceDescription:
    "Requirements: A four-year bachelor's degree with minimum 3 years of professional experience required." })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3)
})

test('a skills and competencies section does not turn client familiarity into mandatory work experience', () => {
  const body = 'QUALIFICATION\nBachelor degree.\nEXPERIENCE\nFresher\nSKILLS AND COMPETENCIES\nStrong communication and experience in working with overseas clients.'
  for (const sourceDescription of [body, body.replace(/\n/g, ' ')]) {
    const result = classify({ title: 'Fresher - Benefit Analyst Junior', sourceDescription })
    assert.equal(result.resolved.jobType, 'Full-time Fresher')
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
    assert.deepEqual(result.reviewReasons, [])
  }
  for (const requirement of ['You must have prior professional experience in healthcare operations.',
    'Must have prior professional experience in healthcare operations.']) {
    const mandatory = classify({ title: 'Fresher - Benefit Analyst Junior', sourceDescription: `${body}\n${requirement}` })
    assert.equal(mandatory.resolved.jobType, 'Unspecified')
    assert.ok(mandatory.reviewReasons.includes('conflicting_role_eligibility'))
  }
})

test('review flags survive report aggregation and do not become classification failures', () => {
  const part = createClassificationReport()
  recordClassificationDecision(part, { result: classify({ title: 'Graduate', sourceDescription: description }), prediction: prediction() })
  const summary = aggregateClassificationSummaries([part])
  assert.equal(summary.quality.reviewRequired, 1)
  assert.equal(summary.quality.reviewReasons.entry_level_title_with_experienced_prediction, 1)
  assert.equal(summary.resolvedCategories['Full-time Experienced'], 1)
})

test('a validated rewrite cannot erase the employer mandatory experience requirement', () => {
  const job = rewritten('Minimum 5 years of professional experience required. Build software.',
    'Responsibilities: Build and test software. Requirements: No prior work experience required.')
  const original = structuredClone(job)
  assert.equal(postScrapeInput(job, { now }).descriptionOrigin, 'rewrite')
  const result = classify(job, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 5)
  assert.equal(result.inputHash, postScrapeInput(job, { now }).inputHash)
  assert.deepEqual(job, original)
})

test('a validated rewrite cannot manufacture employer professional experience requirements', () => {
  const job = rewritten('No prior work experience required. Fresh graduates are welcome.',
    'Requirements: Minimum 5 years of professional experience required.')
  assert.equal(postScrapeInput(job, { now }).descriptionOrigin, 'rewrite')
  const result = classify(job)
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.experienceProfile.minimumYears, 0)
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
})

test('a cleaned rewrite cannot hide a recruitment-notice source quality failure', () => {
  const job = rewritten('ADVT./2026-27/09 Print Application. ADVT./2026-27/08 Print Application. ADVT./2026-27/07 Print Application.', description)
  assert.equal(postScrapeInput(job, { now }).descriptionOrigin, 'rewrite')
  const result = classify(job)
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.equal(result.status, 'uncertain')
  assert.ok(result.sourceQualityIssues.includes('multiple_recruitment_notices_without_role_description'))
})
