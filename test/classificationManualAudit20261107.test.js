import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'
import { getAuthoritativeClassification } from '../src/services/jobClassificationPolicy.js'

const now = new Date('2026-11-07T00:00:00Z')
const prediction = label => ({ modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(value => [value, value === label ? .97 : .01])) })
const classify = (job, label = 'Full-time Experienced') => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })

test('apprentice education-to-joining interval does not become five years of work experience', () => {
  const job = { title: 'Apprentice', minimumQualification: "Bachelor's Degree",
    sourceDescription: "Provide customer service support and resolve customer queries. Bachelor's degree. Not more than 5 years of difference between highest education degree completion date and Joining date. Should not have enrolled in any prior Government Apprenticeship programs. A willingness to learn and adapt to new tasks and challenges." }
  const result = classify(job)
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
  assert.ok(!result.reviewReasons.includes('entry_level_title_with_required_experience'))
})

test('an education interval does not erase a separate mandatory professional requirement', () => {
  const result = classify({ title: 'Apprentice', sourceDescription:
    'Not more than 5 years of difference between highest education degree completion date and Joining date. Candidates must have 3 years of professional experience.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3)
})

test('assessing other applicants experience is a recruiting duty, including a misplaced qualification', () => {
  for (const possessive of ["applicant's", 'applicant\u2019s', "applicants'"]) {
    const duty = `Assess ${possessive} relevant experience, knowledge, skills and competencies`
    const result = classify({ title: 'Entry Level Associate', minimumQualification: duty,
      sourceDescription: `Job Title: Entry Level Associate - Direct Hire. You'll do: ${duty}. You'll Need: Excellent communication skills, MS Office and learning agility.` })
    assert.equal(result.resolved.jobType, 'Full-time Fresher', possessive)
  }
})

test('a recruiter still requires experience when the employer states the recruiters own requirement', () => {
  const result = classify({ title: 'Entry Level Associate', minimumQualification:
    "Prior professional recruitment experience is required to assess applicant's relevant experience, knowledge and skills.",
    sourceDescription: 'Source and screen candidates and coordinate interviews.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('required experience performing applicant screening survives cleanup of the nested third-party experience', () => {
  for (const requirement of [
    "Experience assessing applicant's relevant experience is required.",
    "Experience screening candidates' prior experience is mandatory.",
  ]) {
    const result = classify({ title: 'Entry Level Associate', minimumQualification: requirement,
      sourceDescription: 'Source candidates and coordinate recruitment interviews.' })
    assert.equal(result.resolved.jobType, 'Full-time Experienced', requirement)
  }
})

test('preferred industry does not make the preceding eight-year work requirement optional', () => {
  const qualification = 'Education Qualification: BE / B.Tech in Civil Engineering Work Experience (Range of years): 8 years of work experience Preferred Industry: Construction and Infrastructure Development'
  const result = classify({ title: 'Bid & Cost Estimation Executive - Metro', minimumQualification: qualification,
    sourceDescription: `Prepare detailed cost estimates and compare contractor offers with internal estimates. ${qualification}` }, 'Contract')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 8)
  assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears, null)
})

test('a genuinely preferred experience clause does not become mandatory when industry is also preferred', () => {
  const result = classify({ title: 'Entry Level Engineer', sourceDescription:
    'Required Qualifications: Engineering degree and willingness to learn. Preferred Qualifications: 8 years of construction experience. Preferred Industry: Infrastructure.' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
  assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears, 8)
})

test('permanent contract in an employer employment field means permanent employment', () => {
  const result = classify({ title: 'Discipline Engineer', sourceEmploymentType: 'Permanent contract',
    sourceDescription: 'Full time. Required qualifications: 2-4 years of professional engineering experience.' }, 'Contract')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('permanent contract followed by Job Posting metadata is not a temporary contract job', () => {
  const result = classify({ title: 'Discipline Engineer', sourceDescription:
    'Required qualifications: 2-4 years of professional discipline-engineering experience.\nJob:\nEngineering Disciplines Organization:\nGTSC Mechanical Schedule:\nFull time\nEmployee Status:\nRegular Job Type:\nPermanent contract Job Posting Date:\n2026-11-05' }, 'Contract')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 2)
})

test('temporary full-time work stays Contract despite full-time hours', () => {
  const result = classify({ title: 'Discipline Engineer', sourceEmploymentType: 'Temporary contract',
    sourceDescription: 'This is a temporary contract role. Schedule: Full time. Required qualifications: 2-4 years of experience.' })
  assert.equal(result.resolved.jobType, 'Contract')
})

test('non-permanent contracts never become permanent employment by substring normalization', () => {
  for (const sourceEmploymentType of ['Non-permanent contract', 'Non permanent contract']) {
    const result = classify({ title: 'Support Analyst', sourceEmploymentType,
      sourceDescription: 'Required qualifications: 2-4 years of professional experience.' })
    assert.equal(result.resolved.jobType, 'Contract', sourceEmploymentType)
  }
})

test('current fixed-term employment outranks a full-time-hours field', () => {
  for (const extra of [{ sourceEmploymentType: 'Full-time' }, {}]) {
    const result = classify({ title: 'Finance Analyst', ...extra, sourceDescription:
      'This role is a fixed-term position for a period of 2 Years. Required qualifications: 2-6 years of professional experience.\nSchedule:\nFull time' })
    assert.equal(result.resolved.jobType, 'Contract')
  }
})

test('the employers explicit Project Intern title identifies a CA industrial placement', () => {
  const result = classify({ title: 'CA Industrial Trainee', sourceDescription:
    "Job Title: Project Intern\nEducation Qualification: Pursuing Chartered Accountant\nSupport accounting and finance projects. Desired Candidate: Having worked in Big 4 firms and completed articleship of 2 years." })
  assert.equal(result.resolved.jobType, 'Intern')
})

test('an employer-stated internship manager title does not identify an internship vacancy', () => {
  const result = classify({ title: 'Programme Manager', sourceDescription:
    'Job Title: Internship Programme Manager\nLead the team that coordinates internships. Candidates must have 5 years of professional experience.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('consultant contract metadata is the current engagement rather than a possible future full-time job', () => {
  const result = classify({ title: 'Graduate Trainee - ORM', sourceDescription:
    'Traineeship Tenure: 6 months (with the possibility of securing a full-time role post completion, based on performance)\nMonitor social-media comments and prepare reports. Qualifications Required: Graduate or relevant diploma.\nTime Type:\nPart time\nContract Type:\nConsultant' }, 'Contract')
  assert.equal(result.resolved.jobType, 'Contract')
})

test('current contract metadata also outranks a separate full-time-hours source field', () => {
  for (const contractType of ['Consultant', 'Contract', 'Temporary', 'Fixed-term']) {
    const result = classify({ title: 'Graduate Trainee - ORM', sourceEmploymentType: 'Full-time', sourceDescription:
      `Traineeship Tenure: 6 months (with the possibility of securing a full-time role post completion, based on performance)\nMonitor comments and prepare reports. Qualifications Required: Graduate or relevant diploma.\nContract Type:\n${contractType}` }, 'Contract')
    assert.equal(result.resolved.jobType, 'Contract', contractType)
  }
})

test('job-profile names do not become employment terms because their occupation starts with contract or internship', () => {
  for (const [title, profile] of [['Contract Accounting Specialist', 'Contract Accounting'], ['Programme Manager', 'Internship Programme Manager']]) {
    const result = classify({ title, sourceDescription:
      `Job Type: ${profile}\nCandidates must have 5 years of professional experience. Lead the delivery team and review its work.` })
    assert.equal(result.resolved.jobType, 'Full-time Experienced', profile)
  }
})

test('permanent employer terms reject a temporary-contract fallback without inventing a full-time subtype', () => {
  for (const heading of ['Contract Type:', 'Contract Type', 'Contract Type -', 'Employment Type:']) {
    const result = classify({ title: 'Copywriter', sourceDescription:
      `Prepare creative concepts with guidance from seniors.\nTime Type:\nFull time\n${heading}\nPermanent` }, 'Contract')
    assert.equal(result.resolved.jobType, 'Unspecified', heading)
    assert.ok(result.sourceQualityIssues.includes('model_conflicts_with_permanent_employment'))
    assert.equal(getAuthoritativeClassification({ classification: result }).jobType, 'Unspecified')
  }
})

test('full-time hours alone do not reject a model Contract label when permanent employment is not stated', () => {
  const result = classify({ title: 'Copywriter', sourceDescription:
    'Prepare creative concepts with guidance from seniors.\nSchedule:\nFull time' }, 'Contract')
  assert.equal(result.resolved.jobType, 'Contract')
})

test('inline engagement metadata identifies the current part-time contract', () => {
  const result = classify({ title: 'Senior Data Engineer - Google Cloud', sourceDescription:
    'Job Title: GCP Data Engineer / Solution Architect (Contract) Engagement Type: Contract, part-time Duration: 3 months (extension possible) Experience: 8-10 years Work Mode: Remote Commitment: 20 hours per week About the Role We need a senior data professional on a short-term, part-time contract.' })
  assert.equal(result.resolved.jobType, 'Contract')
})

test('employer-prefixed contract employee metadata identifies contract employment', () => {
  for (const sourceEmploymentType of [undefined, 'Full-time']) {
    const result = classify({ title: 'Silicon Packaging Design Engineer', sourceEmploymentType,
      sourceDescription: 'Required qualifications: 5 years of professional engineering experience.\nJob Type:\nIntel Contract Employee\nShift:\nShift 1 (India)' })
    assert.equal(result.resolved.jobType, 'Contract', sourceEmploymentType)
  }
})

test('permanent contract employee metadata does not identify temporary employment', () => {
  const result = classify({ title: 'Packaging Engineer', sourceDescription:
    'Candidates must have 5 years of professional engineering experience.\nJob Type:\nPermanent Contract Employee\nShift:\nShift 1' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('managing a team with contractor positions does not make the managers own job a contract', () => {
  const duties = 'Manage a multidisciplinary team of CV algorithm researchers, AI/ML engineers, and edge software developers across full-time and contractor positions.'
  const job = { title: 'Manager Computer Vision & Artificial Intelligence', sourceDescription:
    `${duties}\nExperience: 8+ years of total experience in Computer Vision, Deep Learning, and Software Development.` }
  assert.equal(classify(job).resolved.jobType, 'Full-time Experienced')
  assert.equal(classify({ ...job, sourceDescription: `${job.sourceDescription}\nThis role is a contract position for 6 months.` }).resolved.jobType, 'Contract')
})

test('source-to-contract procurement is the managers process domain rather than their engagement', () => {
  const job = { title: 'Procurement Source to Contract Process Manager', sourceExperienceRequired: '8+ years',
    sourceDescription: 'Lead global procurement process design and improvement. Required qualifications: Over 8 years of experience in procurement operations, process optimization, and global procurement environments.' }
  assert.equal(classify(job, 'Contract').resolved.jobType, 'Full-time Experienced')
  assert.equal(classify({ ...job, sourceEmploymentType: 'Contract' }).resolved.jobType, 'Contract')
  assert.equal(classify({ ...job, title: `${job.title} - 6 Month Contract` }).resolved.jobType, 'Contract')
})

test('non-permanent contract employee metadata retains its temporary meaning', () => {
  const result = classify({ title: 'Packaging Engineer', sourceDescription:
    'Candidates must have 5 years of professional engineering experience.\nJob Type:\nNon-permanent Contract Employee\nShift:\nShift 1' })
  assert.equal(result.resolved.jobType, 'Contract')
})

test('negated contract employee metadata cannot use the negation as an employer name', () => {
  for (const prefix of ['Non', 'Not', 'No', 'Never']) {
    const result = classify({ title: 'Packaging Engineer', sourceDescription:
      `Candidates must have 5 years of professional engineering experience.\nJob Type:\n${prefix} Contract Employee\nShift:\nShift 1` })
    assert.equal(result.resolved.jobType, 'Full-time Experienced', prefix)
  }
})

test('maintaining another persons engagement field does not override the applicants permanent employment', () => {
  for (const prefix of ['', 'Job Title: HR Operations Manager Duties: ', 'Job Title: HR Operations Manager. ']) {
    const result = classify({ title: 'HR Operations Manager', sourceDescription:
      `${prefix}Maintain workforce reports including Engagement Type: Contract for vendors. Candidates must have 5 years of professional HR experience.\nEmployment Type:\nPermanent` })
    assert.equal(result.resolved.jobType, 'Full-time Experienced', prefix)
  }
})
