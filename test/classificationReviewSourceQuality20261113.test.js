import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-13T03:05:48Z')
const predict = modelLabel => ({ modelLabel, fullDescriptionCovered: true, windows: 1,
  scores: Object.fromEntries(['Full-time Experienced', 'Full-time Fresher', 'Intern', 'Contract']
    .map(label => [label, label === modelLabel ? .97 : .01])) })

for (const [name, sourceDescription, issue, extra] of [
  ['application instruction', 'Apply via the employer careers page.', 'sparse_role_description'],
  ['recruiter placeholder', 'To be updated by recruiter.', 'sparse_role_description'],
  ['publisher credit', 'Posted by : New Space Research & Technologies |', 'sparse_role_description'],
  ['qualifications without duties', 'Job Description', 'sparse_role_description', { minimumQualification: 'B.E. / B.Tech in Computer Science or equivalent qualification from a recognized university.' }],
  ['truncated description', 'Quality Roles and Responsibilities: Will be involved in day to day Quality activities, incoming inspection, in-process and final inspection, acceptance and cre...', 'truncated_role_description'],
  ['closed vacancy', 'This position is no longer accepting applications. Explore our other career opportunities.', 'closed_vacancy'],
  ['student scholarship', 'A scholarship and workshop programme for university students, with the opportunity to interview for future internship roles.', 'non_vacancy_programme', { title: 'True North Scholarship for Women' }],
]) for (const model of ['Intern', 'Contract', 'Full-time Experienced']) test(`source availability: ${name}/${model}`, () => {
  const result = resolvePostScrapeClassification({ title: 'Analyst', sourceDescription, ...extra }, predict(model), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert.equal(result.status, 'uncertain')
  assert(result.sourceQualityIssues.includes(issue))
  assert.equal(result.resolved.experienceProfile.minimumYears, null)
})

test('short but explicit prior employment remains usable', () => {
  const result = resolvePostScrapeClassification({ title: 'Engineer', sourceDescription:
    'Past working experience in infrastructural professional environment required.' }, predict('Intern'), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert.deepEqual(result.sourceQualityIssues, [])
})

test('a short real role caption retains fallback and a review flag without numeric claims', () => {
  const result = resolvePostScrapeClassification({ title: 'Cloud Engineer',
    sourceDescription: 'Protects cloud-based infrastructure, data, and applications.' }, predict('Full-time Experienced'), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert(result.reviewReasons.includes('sparse_role_description'))
  assert.equal(result.resolved.experienceProfile.minimumYears, null)
})

test('complete role without numeric eligibility still permits ordinary model fallback', () => {
  const sourceDescription = 'Build and operate software services for customers. Collaborate with engineering and design teams to improve reliability, investigate production issues, and document technical decisions.'
  for (const model of ['Intern', 'Contract', 'Full-time Experienced']) {
    const result = resolvePostScrapeClassification({ title: 'Engineer', sourceDescription }, predict(model), { now, mode: 'policy' })
    assert.equal(result.resolved.jobType, model)
    assert.equal(result.decisionSource, 'model_fallback')
  }
})

test('an employee administering scholarships still has an ordinary vacancy', () => {
  const result = resolvePostScrapeClassification({ title: 'Scholarship Programme Manager',
    sourceDescription: 'Administer scholarships and workshops. Required qualifications: 5 years of professional experience.' }, predict('Intern'), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Full-time Experienced')
  assert(!result.sourceQualityIssues.includes('non_vacancy_programme'))
})

test('an employer seeking a contractor is distinct from a task involving contractors', () => {
  const result = resolvePostScrapeClassification({ title: 'Cybersecurity Specialist', sourceDescription:
    'Required Contractor Profile: Bachelors degree in computer science. Deliver penetration testing engagements, prepare technical reports and support remediation planning for customers.' }, predict('Contract'), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Contract')
})

for (const [title, sourceDescription, model, issue] of [
  ['Safety Officer', 'Responsibilities: Review vendor contracts and monitor contractors for compliance with site safety policies. Coordinate incident investigations, document findings and train employees on safety procedures.', 'Contract', 'model_contract_from_third_party_duties'],
  ['Project Analyst', 'Responsibilities: Review customer contracts, coordinate implementation projects, track milestones, and work with customer teams to resolve delivery problems. Prepare project documentation and reports.', 'Contract', 'model_contract_from_third_party_duties'],
  ['Piping Engineer (On Third Party Roll)', 'Design piping systems for industrial facilities, review engineering drawings and work with project teams to resolve design issues. Prepare technical documentation and coordinate quality checks.', 'Intern', 'model_intern_without_placement_evidence'],
  ['System Admin 2', 'Maintain production systems, investigate service incidents, and improve reliability. PhonePe Full Time Employee Benefits (Not applicable for Intern or Contract Roles). Benefits include healthcare coverage and wellbeing programmes.', 'Intern', 'model_intern_without_placement_evidence'],
]) test(`fallback must respect evidence ownership: ${title}`, () => {
  const result = resolvePostScrapeClassification({ title, sourceDescription }, predict(model), { now, mode: 'policy' })
  assert.equal(result.resolved.jobType, 'Unspecified')
  assert(result.sourceQualityIssues.includes(issue))
  const own = resolvePostScrapeClassification({ title, sourceDescription, sourceEmploymentType: model === 'Contract' ? 'Contract' : 'Internship' }, predict(model), { now, mode: 'policy' })
  assert.equal(own.resolved.jobType, model)
})
