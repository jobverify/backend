import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const classify = (sourceDescription, fields = {}) => resolvePostScrapeClassification({
  title: 'Commercial Account Manager', sourceEmploymentType: 'Full-time', sourceDescription, ...fields,
}, { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 },
}, { now: new Date('2026-11-07T00:00:00Z'), mode: 'policy' })

const education = 'Education & Experience Recommended '
  + 'Four-year or Graduate Degree in Sales, Marketing, Business Administration, or any other related discipline or commensurate work experience or demonstrated competence. '
  + 'Typically has 2-4 years of work experience, preferably in account management, tele sales, product specialty (computers, printers, servers, storage), or a related field or an advanced degree with little or no work experience.'

test('an advanced-degree route with no work experience can qualify for a regular account role', () => {
  const result = classify(`Participates in client meetings and supports contract negotiations with guidance from senior team members. ${education}\nPreferred Certifications: Certified Technology Sales Professional.\nComplexity: Responds to routine issues within established guidelines.`)
  assert.equal(result.resolved.jobType, 'Full-time Fresher')
  assert.equal(result.resolved.experienceProfile.minimumYears, 0)
})

test('an education alternative does not waive a separate universal professional-work requirement', () => {
  const requirements = [
    'All candidates must have 5 years of professional account-management experience.',
    'Prior professional account-management experience is required.',
    'Prior account-management experience is required.',
    'Previous employment in account management is required.',
  ]
  for (const requirement of requirements) {
    for (const text of [`${requirement}\n${education}`, `${education}\n${requirement}`]) {
      assert.equal(classify(text).resolved.jobType, 'Full-time Experienced', text)
    }
  }
})

test('bullets do not hide a separately mandatory prior-work statement', () => {
  for (const marker of ['- ', '\u2022 ', '1) ', 'Required qualifications: \u2022 ', '- Required qualifications: ']) {
    for (const requirement of ['Prior account-management experience is required.', 'Previous employment in account management is required.']) {
      assert.equal(classify(`${marker}${requirement}\n${education}`).resolved.jobType, 'Full-time Experienced', marker + requirement)
    }
  }
})

test('required academic project experience does not become mandatory professional employment', () => {
  assert.equal(classify(`Prior academic project experience is required.\n${education}`).resolved.jobType, 'Full-time Fresher')
})

test('positive native professional-experience fields retain their independent requirement', () => {
  assert.equal(classify(education, { sourceExperienceRequired: '5+ years' }).resolved.jobType, 'Full-time Experienced')
})

test('an advanced degree without a zero-work waiver is not a fresher route', () => {
  assert.equal(classify('Required qualifications: Degree. 2-4 years of professional sales experience. An advanced degree is preferred.').resolved.jobType, 'Full-time Experienced')
})

test('training other people on a zero-work degree route does not change the trainers eligibility', () => {
  assert.equal(classify('Required qualifications: 8 years of professional sales experience. Responsibilities: Mentor applicants on an advanced degree with little or no work experience.').resolved.jobType, 'Full-time Experienced')
})

test('a degree-based fresher route does not replace a stated contract or internship engagement', () => {
  assert.equal(classify(education, { sourceEmploymentType: 'Contract' }).resolved.jobType, 'Contract')
  assert.equal(classify(education, { title: 'Research Intern', sourceEmploymentType: 'Internship' }).resolved.jobType, 'Intern')
})

test('a zero-work degree route cannot bypass a nonnumeric mandatory employment requirement', () => {
  const route = 'Required qualifications: A graduate degree or an advanced degree with little or no work experience.'
  for (const requirement of ['Prior account-management experience is required.', 'Previous employment in account management is required.']) {
    assert.equal(classify(`${route}\n${requirement}`).resolved.jobType, 'Full-time Experienced', requirement)
    for (const field of ['sourceExperienceRequired', 'minimumQualification']) {
      assert.equal(classify(route, { [field]: requirement }).resolved.jobType, 'Full-time Experienced', field + requirement)
    }
  }
})

test('mandatory work eligibility applies regardless of the experience statement order', () => {
  for (const requirement of [
    'Required qualifications: Experience in account management is mandatory.',
    'Required qualifications: Applicants must have account-management experience.',
    'All applicants must have spent three years in paid account-management roles.',
  ]) {
    assert.equal(classify(`${education}\n${requirement}`).resolved.jobType, 'Full-time Experienced', requirement)
  }
})

test('a degree route conditional on prior employment does not waive that condition', () => {
  const route = 'Required qualifications: A degree with two years of work experience or an advanced degree with little or no work experience'
  for (const condition of [
    'is acceptable only if the applicant also has previous employment in account management.',
    'may qualify only with prior client-service experience.',
    'provided applicants have prior employment in account management.',
  ]) {
    assert.equal(classify(`${route} ${condition}`).resolved.jobType, 'Full-time Experienced', condition)
  }
  assert.equal(classify(`${route} provided applicants have prior academic project experience.`).resolved.jobType, 'Full-time Fresher')
})

test('recruiting or advising other applicants does not describe this applicants degree route', () => {
  for (const duty of ['Experience recruiting candidates with', 'Experience advising applicants with']) {
    const text = `Required qualifications: ${duty} a graduate degree and two years of work experience or an advanced degree with little or no work experience.\nResponsibilities: Manage the recruitment team budget and performance reviews.`
    assert.equal(classify(text, { title: 'Talent Acquisition Manager' }).resolved.jobType, 'Full-time Experienced', duty)
  }
})

test('academic or internship qualifiers after experience preserve a fresher alternative', () => {
  const route = 'Required qualifications: Freshers or 1 to 2 years of relevant experience.'
  for (const requirement of [
    'Candidates must have experience from academic projects or internships.',
    'Applicants must have experience gained through an internship.',
    'Applicants must have experience with academic coursework in Python.',
  ]) {
    assert.equal(classify(`${route}\n${requirement}`).resolved.jobType, 'Full-time Fresher', requirement)
  }
})

test('customer and product experience outcomes are not applicant work history', () => {
  const route = 'Required qualifications: Freshers or 1 to 2 years of relevant experience.'
  assert.equal(classify(`${route}\nResponsibilities:\nExcellent user experience is essential.`).resolved.jobType, 'Full-time Fresher')
  for (const requirement of ['Excellent user experience is essential.', 'Positive customer experience is required.']) {
    assert.equal(classify(`Required qualifications: Bachelor degree.\nResponsibilities:\n${requirement}`, { title: 'Software Engineer' }).resolved.jobType, 'Full-time Experienced')
    const result = resolvePostScrapeClassification({title:'Software Engineer',sourceEmploymentType:'Full-time',sourceDescription:`Required qualifications: Bachelor degree.\nResponsibilities:\n${requirement}`}, {modelLabel:'Full-time Fresher',fullDescriptionCovered:true,windows:1,scores:{'Full-time Fresher':.97,'Full-time Experienced':.01,Intern:.01,Contract:.01}}, {now:new Date('2026-11-07T00:00:00Z'),mode:'policy'})
    assert.equal(result.resolved.jobType, 'Full-time Fresher', requirement)
  }
})

test('required tool experience can come from an explicit fresher route', () => {
  for (const requirement of ['Experience with Python is required.', 'Applicants must have hands-on experience with Python.', 'Candidates must have strong hands-on experience with Java, Python, or SQL.']) {
    assert.equal(classify(`Required qualifications: Freshers or 1 to 2 years of relevant experience.\n${requirement}`, {title:'Software Engineer'}).resolved.jobType, 'Full-time Fresher', requirement)
  }
})

test('unrelated optional qualifications do not waive a required work-history clause', () => {
  for (const requirement of [
    'Prior account-management experience is required, while an MBA is preferred.',
    'Prior account-management experience is required, while academic projects are an added advantage.',
    'Previous employment in account management is required, while advanced technical skills are optional.',
    'Prior account-management experience is required, and prior research internships are a plus.',
    'An MBA is preferred, while prior account-management experience is required.',
    'Academic projects are an added advantage, while previous employment in account management is required.',
  ]) {
    assert.equal(classify(`${education}\n${requirement}`).resolved.jobType, 'Full-time Experienced', requirement)
  }
})

test('a work requirement restricted to the experience route does not veto freshers', () => {
  assert.equal(classify('Required qualifications: Freshers or 1 to 2 years of relevant experience.\nPrior account-management experience is required only for candidates using the experience-based route.').resolved.jobType, 'Full-time Fresher')
  assert.equal(classify(`${education}\nPrior account-management experience is required only for candidates using the experience-based route.`).resolved.jobType, 'Full-time Fresher')
})

test('a route-specific clause cannot suppress a separate mandatory employment clause', () => {
  for (const requirement of [
    'Previous employment in account management is mandatory, while prior sales experience is required only for the experienced route.',
    'Prior sales experience is required only for the experienced route, while previous employment in account management is mandatory.',
  ]) assert.equal(classify(`${education}\n${requirement}`).resolved.jobType, 'Full-time Experienced', requirement)
})

test('a negated unrelated requirement cannot suppress mandatory prior employment', () => {
  for (const optional of ['an MBA is not required', 'prior sales experience is not required']) {
    assert.equal(classify(`${education}\nPrevious employment in account management is mandatory, while ${optional}.`).resolved.jobType, 'Full-time Experienced', optional)
  }
})

test('an academic continuation can satisfy the same experience requirement', () => {
  for (const route of ['Required qualifications: Freshers or 1 to 2 years of relevant experience.', education]) {
    for (const requirement of [
      'Candidates must have prior experience, and it may come from academic projects.',
      'Prior experience is required, and academic projects may be used to meet this requirement.',
    ]) assert.equal(classify(`${route}\n${requirement}`).resolved.jobType, 'Full-time Fresher', requirement)
  }
})

test('IT qualifications are separate subjects rather than an experience pronoun', () => {
  for (const qualification of ['IT certification is preferred', 'IT skills are optional']) {
    assert.equal(classify(`${education}\nPrevious employment in account management is mandatory, and ${qualification}.`).resolved.jobType, 'Full-time Experienced', qualification)
  }
  assert.equal(classify(`${education}\nPrevious experience is required, and it may come from academic projects.`).resolved.jobType, 'Full-time Fresher')
})

test('an expressly excluded academic source does not waive required prior work', () => {
  assert.equal(classify(`${education}\nPrevious experience is required, and it must not come from academic projects.`).resolved.jobType, 'Full-time Experienced')
})
