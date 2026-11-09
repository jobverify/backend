import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

// Explicit offline classifier controls, not native posting or HTTP evidence.
const control = { title: 'Engineering Analyst', company: 'Offline classifier control',
  jobDescription: 'Artificial control for preserving an unresolved source employment field.' }

test('an unresolved native employment field cannot become the generic full-time default', () => {
  const job = normalizeScrapedJob({ ...control, employmentType: null, sourceEmploymentTypeUnresolved: true })
  assert.equal(job.employmentType, null)
  assert.equal(job.sourceEmploymentType, null)
  assert.equal(job.jobType, 'Unspecified')
})

test('the existing generic employment default remains unchanged when no unresolved-source flag is supplied', () => {
  const job = normalizeScrapedJob(control)
  assert.equal(job.employmentType, 'Full-time')
})

test('an explicit source employment value remains distinct from the generic default', () => {
  const job = normalizeScrapedJob({ ...control, employmentType: 'Contract', employmentTypeProvenance: 'source',
    sourceEmploymentTypeUnresolved: false })
  assert.equal(job.employmentType, 'Contract')
  assert.equal(job.sourceEmploymentType, 'Contract')
})

test('explicit internship title evidence remains usable when the separate source employment field is absent', () => {
  const job = normalizeScrapedJob({ ...control, title: 'Engineering Internship',
    employmentType: null, sourceEmploymentTypeUnresolved: true })
  assert.equal(job.employmentType, 'Internship')
  assert.equal(job.sourceEmploymentType, null)
})

test('a literal full-time title remains explicit evidence rather than a generic default', () => {
  const job = normalizeScrapedJob({ ...control, title: 'Full-time Engineering Analyst',
    employmentType: null, sourceEmploymentTypeUnresolved: true })
  assert.equal(job.employmentType, 'Full-time')
  assert.equal(job.sourceEmploymentType, null)
})

test('a negated full-time title cannot authorize that employment type for an unresolved source', () => {
  const job = normalizeScrapedJob({ ...control, title: 'Non-full-time Engineering Analyst',
    employmentType: null, sourceEmploymentTypeUnresolved: true })
  assert.equal(job.employmentType, null)
})

for (const title of ['Senior Full-Stack Engineer, Internal Applications', 'International Sales Manager',
  'Internet Systems Engineer']) test('employment words cannot be borrowed from a larger title word: ' + title, () => {
  assert.deepEqual({
    unresolved: normalizeScrapedJob({ ...control, title, employmentType: null, sourceEmploymentTypeUnresolved: true }).employmentType,
    unflagged: normalizeScrapedJob({ ...control, title, employmentType: null }).employmentType,
  }, { unresolved: null, unflagged: 'Full-time' })
})

test('literal internship trainee and apprentice words retain their meaningful inflected forms', () => {
  for (const title of ['Engineering Intern', 'Software Internship', 'Engineering Internships', 'Engineering Trainee',
    'Software Traineeship', 'Apprentice Engineer', 'Engineering Apprenticeship'])
    assert.equal(normalizeScrapedJob({ ...control, title, employmentType: null,
      sourceEmploymentTypeUnresolved: true }).employmentType, 'Internship')
})
