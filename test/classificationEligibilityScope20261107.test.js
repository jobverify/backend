import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-07T00:00:00Z')
const classify = (job, label = 'Full-time Experienced') => resolvePostScrapeClassification(job, {
  modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(value => [value, value === label ? .97 : .01])),
}, { now, mode: 'policy' })

test('contractual employment metadata states a contract rather than an occupational specialty', () => {
  for (const sourceEmploymentType of [undefined, 'Full-time']) {
    const result = classify({ title: 'Consultant - Content Strategist', sourceEmploymentType, sourceDescription:
      'Employment Type: Contractual role for 12 months.\nDesired Experience:\n2-5 years of hands-on SEO content experience, including internships and freelance work.' })
    assert.equal(result.resolved.jobType, 'Contract', sourceEmploymentType)
  }
  assert.equal(classify({ title: 'Contractual Operations Manager', sourceDescription:
    'Manage commercial agreement operations. Required qualifications: 5 years of professional experience.' }).resolved.jobType, 'Full-time Experienced')
})

test('a finite fixed-term contract title is compatible with full-time working hours', () => {
  const result = classify({ title: 'Accounting & Reporting Analyst (1 year Fixed Term Contract)', sourceEmploymentType: 'Full-time',
    sourceDescription: 'Support financial reporting and monthly closing. Candidates must have 2 years of professional accounting experience.' })
  assert.equal(result.resolved.jobType, 'Contract')
  assert.equal(classify({ title: 'Fixed Term Deposit Manager', sourceEmploymentType: 'Full-time', sourceDescription:
    'Manage banking products. Candidates must have 5 years of professional banking experience.' }).resolved.jobType, 'Full-time Experienced')
})

test('flattened mandatory experience after desirable education remains mandatory', () => {
  const result = classify({ title: 'Digital Designer', sourceDescription:
    'Educational Requirements Mandatory: Graduated from Design school / university Desirable: Master degree or equivalent Experience : Mandatory: - Knowledge in industrial design - Minimum 5 years of working experience in Digital design domain - Perfect mastery of design tools - Desirable: Knowledge of railway' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 5)
  assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears, null)
})

test('required skills and qualifications introduce required professional experience', () => {
  const result = classify({ title: 'Motion Graphic Designer', sourceDescription:
    'Required Skills & Qualifications\nExperience in graphic design or a related creative role.\nExperience creating content for social media and digital platforms.\nPreferred Skills\nAgency experience is a plus.\nContract Type:\nPermanent' }, 'Contract')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('the successful-candidate section ends the preceding optional-skills section', () => {
  const result = classify({ title: 'Associate Analyst OCM', sourceEmploymentType: 'Full-time', sourceDescription:
    'Assist managers and leads under guidance.\nPreferred / Desirable Skills\nExperience or coursework related to digital transformation.\nYou will be successful in this role if you have:\nBachelor degree or final-year student in Communications.\n0-2 years of relevant experience (student projects, internships, or part-time roles welcome).' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 0)
})

test('the common possessive spelling of freshers still states fresher eligibility', () => {
  const result = classify({ title: 'Customer Service Associate', sourceDescription:
    'Qualification: Fresher\u2019s or experienced with minimum qualification of degree. Good communication Skill with fluency in Malayalam. Ready to work in rotational shift.' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(classify({ title: 'Customer Service Associate', sourceDescription:
    'Freshers are not eligible. Candidates must have 3 years of professional experience.' }).resolved.jobType, 'Full-time Experienced')
})

test('an explicit fresher alternative in a work-experience field is not a mandatory one-year minimum', () => {
  const result = classify({ title: 'Screener', sourceDescription:
    'Educational Qualifications: Degree and screening certification. Preferred: Additional screening certification. Work Experience: Freshers or 1-2 years of experience in security screening or a related field. Attend all regulatory trainings.' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
})

test('an open-ended upper experience bound on an alternative path does not exclude freshers', () => {
  const result = classify({ title: 'Associate, Financial Reporting', sourceDescription:
    'Required qualifications: CA qualified.\nFresher or 1 to 2+ years hands on experience in general accounting.\nArticleship with Big Four is a must.\nSchedule:\nRegular\nEmployee Status:\nFull time' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
})

test('not mandatory experience stays optional when a flattened heading is restored', () => {
  const result = classify({ title: 'Graduate Engineer', sourceDescription:
    'Required qualifications: Engineering degree.\nPreferred qualifications:\nNot mandatory: 3 years of professional software development experience.' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
  assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears, 3)
})

test('a separate mandatory professional requirement is not waived by a fresher alternative', () => {
  const alternative = 'Fresher or 1 to 2+ years hands on experience in general accounting.'
  for (const sourceDescription of [
    `${alternative}\nCandidates must have prior professional accounting experience.`,
    `Prior professional accounting experience is required.\n${alternative}`,
  ]) assert.equal(classify({ title: 'Accounting Associate', sourceDescription }).resolved.jobType, 'Full-time Experienced')
})

test('a negated finite fixed-term title does not identify contract employment', () => {
  const result = classify({ title: 'Accounting Analyst (Not a 1 year Fixed Term Contract)', sourceEmploymentType: 'Full-time',
    sourceDescription: 'Permanent role. Candidates must have 2 years of professional accounting experience.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('a positive fixed-term title and affirmative permanent metadata require source review', () => {
  const result = classify({ title: 'Accounting Analyst (1 year Fixed Term Contract)', sourceEmploymentType: 'Full-time',
    sourceDescription: 'Candidates must have 2 years of professional accounting experience.\nEmployment Type:\nPermanent' })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.ok(result.sourceQualityIssues.includes('conflicting_employment_terms'))
})

test('standalone mandatory qualifications start a new required professional-experience section', () => {
  const result = classify({ title: 'Graphic Designer', sourceDescription:
    'Preferred qualifications:\nMaster degree in design.\nMandatory:\nExperience working as a graphic designer in a creative agency.\nContract Type:\nPermanent' }, 'Contract')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('required assessment of other applicants professional experience does not veto the recruiters fresher route', () => {
  const sourceDescription = 'Work Experience: Freshers or 1 to 2+ years of experience in recruitment.\nResponsibilities:\nCoordinate interviews and update candidate records.'
  for (const possessive of ["applicant's", 'applicant\u2019s', "applicants'"]) {
    const duty = `Assessing ${possessive} professional experience is required before shortlisting.`
    for (const job of [
      { title: 'Entry Level Associate', sourceDescription: `${sourceDescription}\n${duty}` },
      { title: 'Entry Level Associate', sourceDescription, minimumQualification: duty },
    ]) assert.equal(classify(job).resolved.jobType, 'Full-time Fresher', possessive)
  }
  assert.equal(classify({ title: 'Entry Level Associate', sourceDescription,
    minimumQualification: "Prior professional experience assessing applicant's relevant experience is required." }).resolved.jobType, 'Full-time Experienced')
})
