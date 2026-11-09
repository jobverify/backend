import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { buildClassificationInput } from '../src/services/jobClassificationPolicy.js'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-07T00:00:00Z')
const prediction = label => ({ modelLabel: label, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(value => [value, value === label ? .97 : .01])) })
const classify = (job, label = 'Full-time Experienced') => resolvePostScrapeClassification(job, prediction(label), { now, mode: 'policy' })
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/classificationSourceBoundaries20261107.json', import.meta.url)))

for (const fixture of fixtures) {
  test(`complete saved source and selected input preserve appointment/eligibility: ${fixture.id}`, () => {
    const input = buildClassificationInput(fixture.job, { now })
    assert.equal(input.descriptionOrigin, fixture.descriptionOrigin)
    assert.equal(createHash('sha256').update(input.body).digest('hex'), fixture.canonicalBodySha256)
    for (const job of [fixture.job, { ...fixture.job, descriptionRewrite: null, description: fixture.job.sourceDescription }]) {
      const result = classify(job)
      assert.equal(result.resolved.jobType, fixture.expectedJobType)
      if (fixture.minimumYears !== null) {
        assert.equal(result.resolved.employerExperienceProfile.minimumYears, fixture.minimumYears)
        assert.equal(result.resolved.employerExperienceProfile.maximumYears, fixture.maximumYears)
      }
    }
  })
}

for (const heading of ['Desired skills:', 'Desired skills', 'DESIRED SKILLS:']) {
  test(`flattened ${heading} leaves preceding required experience intact`, () => {
    const result = classify({ title: 'Operations Analyst', sourceDescription:
      `Requirements: Graduate degree. Experience Range* 3-5 years Foundational skills* Communication and attention to detail ${heading} Knowledge of mortgage operations.` }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Full-time Experienced')
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3)
    assert.equal(result.resolved.employerExperienceProfile.maximumYears, 5)
  })

  test(`experience following ${heading} remains optional`, () => {
    const result = classify({ title: 'Entry Level Analyst', sourceDescription:
      `Required Qualifications: University degree and willingness to learn. ${heading} 4-6 years of professional banking experience.` })
    assert.equal(result.resolved.jobType, 'Full-time Fresher')
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
    assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears, 4)
  })
}

test('a required section after desired skills restores mandatory professional history', () => {
  const result = classify({ title: 'Entry Level Analyst', sourceDescription:
    'Desired skills: 5 years of banking experience. Required qualifications: Candidates must have 2 years of professional work experience.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 2)
})

test('desired-skills prose does not waive a separate mandatory work statement', () => {
  const result = classify({ title: 'Operations Analyst', sourceDescription:
    'Candidates must have 3 years of professional experience assessing desired skills of applicants. Required qualifications: Degree and communication skills.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3)
})

for (const qualification of [
  'Required qualifications: Experience assessing desired skills of applicants. Previous professional experience is required.',
  'Assess desired skills of applicants. Previous professional experience is required.',
  'Required qualifications: Experience assessing Desired Skills of applicants. Previous professional experience is required.',
  'Previous professional experience assessing desired skills of applicants is required.',
  'Required qualifications: Assess skills that are not desired skills of applicants. Previous professional experience is required.',
  'Required qualifications: Assess desired skills of applicants and screen their resumes. Candidates must have previous professional experience.',
  'Required qualifications: Foundational skills: Ability to identify Desired Skills of applicants during interviews. Previous professional experience is required.',
  'Foundational skills: Applicant assessment. Requirements: Experience reviewing the Desired Skills field of applications. Previous professional experience is required.',
  "Foundational skills: Applicant assessment. Required qualifications: Review the 'Desired Skills' field of applications. Previous professional experience is required.",
]) {
  test(`ordinary assessment prose does not open an optional section: ${qualification}`, () => {
    const result = classify({ title: 'Entry Level Analyst', sourceDescription: qualification }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Full-time Experienced')
  })
}

test('an inline experience range does not waive a separate mandatory prior-work condition', () => {
  const result = classify({ title: 'Entry Level Analyst', sourceDescription:
    'Required qualifications: Candidates must have previous professional experience. Experience Range* 0-2 years Foundational skills* Communication Desired skills Knowledge of banking.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('a range inside a preferred section stays optional before desired skills', () => {
  const result = classify({ title: 'Entry Level Analyst', sourceDescription:
    'Required qualifications: Degree. Preferred qualifications: Experience Range* 4-6 years Foundational skills* Communication Desired skills Knowledge of banking.' })
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears, null)
})

for (const appointment of [
  'This role is for a fixed term of 6 months.',
  'The position is based in Delhi and is for a fixed term of 3 years.',
]) {
  test(`the vacancy's finite appointment outranks experience and full-time hours: ${appointment}`, () => {
    const result = classify({ title: 'Corporate Counsel', sourceEmploymentType: 'Full-time', sourceDescription:
      `${appointment} Minimum qualifications: 5+ years of professional legal experience. Schedule: Full time.` })
    assert.equal(result.resolved.jobType, 'Contract')
  })
}

test('fixed terms of legal agreements are duties rather than this vacancy employment', () => {
  const result = classify({ title: 'Corporate Counsel', sourceDescription:
    'The position is based in Delhi. Advise on agreements for a fixed term of 3 years and review their renewal. Required qualifications: 5+ years of professional legal experience.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

for (const duty of [
  "Check whether the client's employment is for a fixed term of 6 months.",
  'Advise employees whose position is for a fixed term of 3 years.',
  'Recruit a candidate whose role is for a fixed term of 6 months.',
  'If another position is for a fixed term of 3 years, advise its incumbent.',
  'Manage staff whose employment is for a fixed term of 6 months.',
  "Audit cases in which a customer's job is for a fixed term of 3 years.",
  "Determine whether a supplier's position is based in Delhi and is for a fixed term of 3 years.",
  'Explain to workers that their employment is for a fixed term of 6 months.',
  'If the role is for a fixed term of 6 months, obtain legal approval before offering a separate vacancy.',
]) {
  test(`another person's finite term does not define this vacancy: ${duty}`, () => {
    for (const sourceEmploymentType of [undefined, 'Permanent']) {
      const result = classify({ title: 'Employment Advisor', sourceEmploymentType, sourceDescription:
        `Duties: ${duty} Required qualifications: Candidates must have 3 years of professional work experience.` })
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
    }
  })
}

test('negated finite appointment does not make a contract vacancy', () => {
  const result = classify({ title: 'Corporate Counsel', sourceDescription:
    'This role is not for a fixed term of 3 years. Minimum qualifications: 5+ years of professional legal experience.' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
})

test('permanent employer terms still hold a conflicting finite appointment for review', () => {
  const result = classify({ title: 'Corporate Counsel', sourceEmploymentType: 'Permanent', sourceDescription:
    'The position is based in Delhi and is for a fixed term of 3 years. Minimum qualifications: 5+ years of professional legal experience.' })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.ok(result.reviewReasons.length > 0)
})

test('a conditional appointment to a separate vacancy does not contradict this permanent job', () => {
  const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
    'The role is for a fixed term of 6 months only if appointed to a separate client vacancy. This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
})

test('an example-vacancy section does not describe this permanent job', () => {
  const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
    'Duties: Explain sample job descriptions to employees.\nExample vacancy:\nThe role is for a fixed term of 6 months.\nThis vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
})

test('a condition on renewal does not erase the present finite appointment', () => {
  const result = classify({ title: 'Corporate Counsel', sourceEmploymentType: 'Full-time', sourceDescription:
    'The position is based in Delhi and is for a fixed term of 3 years, renewable only if both parties agree. Required qualifications: 5+ years of professional legal experience.' })
  assert.equal(result.resolved.jobType, 'Contract')
})

test('an explicit current-vacancy heading restores scope after an example section', () => {
  const result = classify({ title: 'Corporate Counsel', sourceEmploymentType: 'Full-time', sourceDescription:
    'Example vacancy:\nThe role is for a fixed term of 6 months.\nCurrent vacancy:\nThe position is based in Delhi and is for a fixed term of 3 years. Required qualifications: 5+ years of professional legal experience.' })
  assert.equal(result.resolved.jobType, 'Contract')
})

for (const heading of [
  'Example vacancy (for training only):',
  'Sample job description (not this vacancy):',
  'Example vacancy 1:',
  'Other vacancy details:',
  'Illustrative job description for clients:',
]) {
  test(`a qualified example heading still marks another vacancy: ${heading}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
      `${heading}\nThe role is for a fixed term of 6 months.\nThis vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Full-time Experienced')
    assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
  })
}

test('a renewal-project noun does not make a conditional appointment unconditional', () => {
  const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
    'The role is for a fixed term of 6 months on the renewal project only if you elect a separate client vacancy. This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
})

for (const renewal of [
  ', renewable only if both parties agree',
  ', subject to renewal if both parties agree',
  ', extension possible only when funding is approved',
  ', to be extended provided that funding continues',
]) {
  test(`a condition expressly on extending the appointment preserves its current term: ${renewal}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
      `This role is for a fixed term of 6 months${renewal}. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Contract')
  })
}

for (const responsibilities of [
  'Other role responsibilities:',
  'Example role responsibilities:',
]) {
  test(`ordinary responsibility labels do not hide the actual appointment: ${responsibilities}`, () => {
    const result = classify({ title: 'Corporate Counsel', sourceEmploymentType: 'Full-time', sourceDescription:
      `${responsibilities} Review customer agreements.\nThe position is based in Delhi and is for a fixed term of 3 years. Required qualifications: 5+ years of professional legal experience.` })
    assert.equal(result.resolved.jobType, 'Contract')
  })
}

for (const heading of [
  'Sample job description (training: not this vacancy):',
  'Example vacancy - for training only:',
  'Example vacancy (for training, e.g. internal workshops):',
  'Sample job description (training (example: not this vacancy)):',
]) {
  test(`annotated sample sections stay separate from current employment: ${heading}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
      `${heading}\nThe role is for a fixed term of 6 months.\nCurrent vacancy: This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Full-time Experienced')
    assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
  })
}

for (const heading of [
  'Other details:',
  'Other (employment terms):',
  'Other details (for this job):',
  'Other:',
]) {
  test(`generic details of this vacancy do not mark another vacancy: ${heading}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
      `${heading}\nThis role is for a fixed term of 6 months. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Contract')
  })
}

test('possible renewal does not waive the present finite appointment', () => {
  const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
    'This role is for a fixed term of 6 months, with possible renewal only if funding is approved. Required qualifications: Candidates must have 3 years of professional work experience.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Contract')
})

test('an annotated current-vacancy heading restores its own appointment scope', () => {
  const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
    'Example vacancy:\nThe role is for a fixed term of 3 years.\nCurrent vacancy (this posting):\nThis role is for a fixed term of 6 months. Required qualifications: Candidates must have 3 years of professional work experience.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Contract')
})

for (const appointment of [
  'This role is for a fixed term of 6 months (full-time hours apply. This is not an internship).',
  'The position is for a fixed term of 3 years (full-time hours apply; this is not a permanent appointment).',
  'Employment details (\nThis role is for a fixed term of 6 months.\nAll terms refer to this vacancy.)',
  'This role is for a fixed term of 6 months (review after month five. Renewal only if funding is approved).',
]) {
  test(`ordinary appointment notes preserve their sentence boundaries: ${appointment}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
      `${appointment} Required qualifications: Candidates must have 3 years of professional work experience.` })
    assert.equal(result.resolved.jobType, 'Contract')
  })
}

for (const condition of [
  'subject to selection for another vacancy',
  'subject to appointment to a separate position',
  'contingent upon selection for a different role',
  'subject to successful selection for another job',
]) {
  test(`a condition on taking another vacancy does not define this job: ${condition}`, () => {
    for (const sourceEmploymentType of ['Permanent', undefined]) {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months on the renewable energy project ${condition}. This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
    }
  })
}

test('a condition on renewal for another vacancy preserves the initial appointment conflict', () => {
  const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
    'This role is for a fixed term of 6 months, with possible renewal subject to selection for another vacancy. Required qualifications: Candidates must have 3 years of professional work experience.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.ok(result.sourceQualityIssues.includes('conflicting_employment_terms'))
})

for (const suffix of [
  ' on the renewable energy project subject to funding approval',
  ' subject to selection for this vacancy',
]) {
  test(`ordinary conditions on this vacancy preserve its finite appointment: ${suffix}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
      `This role is for a fixed term of 6 months${suffix}. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Contract')
  })
}

for (const condition of [
  'subject to your selection for another vacancy',
  'contingent on being selected for a different role',
  'subject to successful selection into a separate position',
]) {
  test(`natural alternate-vacancy selection wording remains conditional: ${condition}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
      `This role is for a fixed term of 6 months on the renewable energy project ${condition}. This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
    assert.equal(result.resolved.jobType, 'Full-time Experienced')
    assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
  })
}

for (const opportunity of [
  ', with optional future promotion subject to selection for another vacancy',
  ', with an optional later internal transfer contingent upon appointment to a different role',
  ', with access to a future overseas role subject to successful selection for a separate position',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`a later opportunity preserves this appointment under ${sourceEmploymentType}: ${opportunity}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${opportunity}. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
      assert.equal(result.resolved.jobType, sourceEmploymentType === 'Permanent' ? 'Unspecified' : 'Contract')
      assert.equal(result.sourceQualityIssues.includes('conflicting_employment_terms'), sourceEmploymentType === 'Permanent')
    })
  }
}

for (const condition of [
  ', offered only through an internal transfer subject to your selection for another vacancy',
  ', offered solely as a promotion contingent on being appointed to a separate position',
  ', available solely through access to another job subject to successful selection into a different role',
  ', but this initial appointment starts through a transfer only if you are selected for another vacancy',
  ' and this initial appointment begins as a promotion only when you are appointed to a different position',
  ', but the initial term begins through access to another role provided that you are selected for a separate job',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`a condition governing the initial appointment is not a later opportunity under ${sourceEmploymentType}: ${condition}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${condition}. This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
    })
  }
}

test('a current-vacancy heading does not turn an initial selection condition into an optional transfer', () => {
  const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Permanent', sourceDescription:
    'Other vacancy (example: A.1):\nThis role is for a fixed term of 3 years.\nCurrent vacancy (this posting: A.2):\nThis role is for a fixed term of 6 months, but this initial appointment starts through a transfer only if you are selected for another vacancy. This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.' }, 'Full-time Fresher')
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
})

for (const opportunity of [
  ', with optional future promotion available only if you are selected for another vacancy',
  ', with access to a future overseas position that is available only if selected for another vacancy',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`availability of a separate future opportunity preserves the initial term under ${sourceEmploymentType}: ${opportunity}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${opportunity}. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
      assert.equal(result.resolved.jobType, sourceEmploymentType === 'Permanent' ? 'Unspecified' : 'Contract')
      assert.equal(result.sourceQualityIssues.includes('conflicting_employment_terms'), sourceEmploymentType === 'Permanent')
    })
  }
}

for (const opportunity of [
  ', with an opportunity for future promotion subject to selection for another vacancy',
  ', with the possibility of a later internal transfer contingent on being appointed to a separate position',
  ' and a chance of eventual promotion only if you are selected for another vacancy',
  ', with an option for access to a future overseas role subject to your successful selection into a different job',
  ', with optional future access to another role subject to successful appointment to a separate position',
  ', with a possible later international transfer only when selected for another vacancy',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`a separately offered future opportunity preserves this term under ${sourceEmploymentType}: ${opportunity}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${opportunity}. Required qualifications: Candidates must have 3 years of professional work experience.` })
      assert.equal(result.resolved.jobType, sourceEmploymentType === 'Permanent' ? 'Unspecified' : 'Contract')
      assert.equal(result.sourceQualityIssues.includes('conflicting_employment_terms'), sourceEmploymentType === 'Permanent')
    })
  }
}

for (const [heading, opportunity] of [
  ['Other vacancy (example: A.1):\nThis role is for a fixed term of 3 years.\nCurrent vacancy (this posting: A.2):\n', ', with an opportunity for future promotion subject to selection for another vacancy'],
  ['Other details (career: progression):\n', ', with the possibility of a later internal transfer contingent on being appointed to a separate position'],
]) {
  test(`a separate opportunity keeps its scope after the heading ${heading}`, () => {
    const result = classify({ title: 'Operations Analyst', sourceEmploymentType: 'Full-time', sourceDescription:
      `${heading}This role is for a fixed term of 6 months${opportunity}. Required qualifications: Candidates must have 3 years of professional work experience.` })
    assert.equal(result.resolved.jobType, 'Contract')
  })
}

for (const appointment of [
  'The position is for a fixed term of 6 months and does not require relocation.',
  'The position is for a fixed term of 6 months and Python is not required.',
  'Employment terms: This role is for a fixed term of 6 months.',
  '- This role is for a fixed term of 6 months.',
  'This role is for a fixed term of 6 months and offers relocation assistance if you live outside Delhi.',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`an affirmative appointment survives formatting and unrelated conditions under ${sourceEmploymentType}: ${appointment}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `${appointment} Required qualifications: Candidates must have 3 years of professional work experience.` })
      assert.equal(result.resolved.jobType, sourceEmploymentType === 'Permanent' ? 'Unspecified' : 'Contract')
      assert.equal(result.sourceQualityIssues.includes('conflicting_employment_terms'), sourceEmploymentType === 'Permanent')
    })
  }
}

for (const qualifier of [
  ', but this statement is not applicable to the current vacancy',
  ', but that option is no longer available for this vacancy',
  ', a sentence used only as an example and not the terms of this vacancy',
  ', but this term is not offered to applicants for the current vacancy',
  ' and offers relocation assistance if you live outside Delhi, but this initial appointment starts only if you are selected for another job',
  ', provides relocation support only when you live outside Delhi, and this initial appointment is available only when appointed to another job',
  ', includes relocation assistance if you live outside Delhi, but the fixed term commences provided that you are appointed to another position',
  ' and offers relocation support if approved by Finance, but this initial appointment starts contingent on your selection for a separate vacancy',
  ', with optional future promotion, but the initial term is not applicable to the current vacancy',
  ', with a possible later transfer, but this initial appointment is not offered to applicants for the current vacancy',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`a withdrawn or separately conditioned initial term is not an appointment under ${sourceEmploymentType}: ${qualifier}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${qualifier}. This vacancy is permanent. Required qualifications: Candidates must have 3 years of professional work experience.` }, 'Full-time Fresher')
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
    })
  }
}

for (const futureWithdrawal of [
  ', with optional future promotion, but that option is no longer available for this vacancy',
  ', with possible later renewal, but this renewal is not offered to applicants for the current vacancy',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`withdrawal of a separate future opportunity preserves the initial term under ${sourceEmploymentType}: ${futureWithdrawal}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${futureWithdrawal}. Required qualifications: Candidates must have 3 years of professional work experience.` })
      assert.equal(result.resolved.jobType, sourceEmploymentType === 'Permanent' ? 'Unspecified' : 'Contract')
      assert.equal(result.sourceQualityIssues.includes('conflicting_employment_terms'), sourceEmploymentType === 'Permanent')
    })
  }
}



for (const qualifier of [
  ', with renewal if performance is satisfactory and if funding is available',
  ' and may be extended only when funding is approved and only when both parties agree',
  ', with an opportunity for future promotion only if selected for another job and only if a position becomes vacant',
  ', with possible later transfer provided that you are appointed to another role and if you accept the transfer',
  ' and offers relocation assistance if you live outside Delhi and only when Finance approves the expense',
  ', but this term is not applicable to a later permanent appointment',
  ', but this statement is not applicable to the renewal of this contract',
  ', with optional future promotion, but this initial term is not applicable to that promoted role',
  ', with possible renewal, but this fixed term is not offered for the subsequent permanent vacancy',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`coordinated secondary conditions and later-term exclusions preserve this appointment under ${sourceEmploymentType}: ${qualifier}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${qualifier}. Required qualifications: Candidates must have 3 years of professional work experience.` })
      assert.equal(result.resolved.jobType, sourceEmploymentType === 'Permanent' ? 'Unspecified' : 'Contract')
      assert.equal(result.sourceQualityIssues.includes('conflicting_employment_terms'), sourceEmploymentType === 'Permanent')
    })
  }
}

for (const qualifier of [
  ', and this statement is not applicable to the current vacancy',
  ', but this fixed term has been withdrawn from the current vacancy',
]) {
  for (const sourceEmploymentType of ['Full-time', 'Permanent']) {
    test(`withdrawal explicitly applies to this appointment under ${sourceEmploymentType}: ${qualifier}`, () => {
      const result = classify({ title: 'Operations Analyst', sourceEmploymentType, sourceDescription:
        `This role is for a fixed term of 6 months${qualifier}. Required qualifications: Candidates must have 3 years of professional work experience.` })
      assert.equal(result.resolved.jobType, 'Full-time Experienced')
      assert.ok(!result.sourceQualityIssues.includes('conflicting_employment_terms'))
    })
  }
}
