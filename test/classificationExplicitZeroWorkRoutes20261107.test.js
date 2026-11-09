import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { postScrapeInput, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const now = new Date('2026-11-07T00:00:00Z')
const prediction = { modelLabel: 'Full-time Experienced', fullDescriptionCovered: true, windows: 1,
  scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } }
const classify = job => resolvePostScrapeClassification(job, prediction, { now, mode: 'policy' })
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/classificationExplicitZeroWorkRoutes20261107.json', import.meta.url)))

for (const fixture of fixtures) {
  test('full saved zero-work degree alternative: ' + fixture.id, () => {
    const input = postScrapeInput(fixture.job, { now, identity: fixture.historicalIdentity })
    assert.equal(input.inputHash, fixture.archivedInputHash, 'complete archived canonical input remains reproducible')
    assert.equal(input.descriptionOrigin, fixture.descriptionOrigin)
    assert.equal(createHash('sha256').update(input.body).digest('hex'), fixture.canonicalBodySha256)
    assert.equal(createHash('sha256').update(String(fixture.job.sourceDescription)).digest('hex'), fixture.originalTextSha256)
    for (const job of [fixture.job, { ...fixture.job, descriptionRewrite: null, description: fixture.job.sourceDescription }]) {
      const result = classify(job)
      assert.equal(result.resolved.jobType, fixture.expectedJobType)
      assert.equal(result.resolved.experienceProfile.minimumYears, 0)
      assert.equal(result.resolved.employerExperienceProfile.minimumYears, fixture.employerNumericMinimumYears)
    }
  })

  test('native professional-work requirement still applies to degree route: ' + fixture.id, () => {
    assert.equal(classify({ ...fixture.job, sourceExperienceRequired: '5+ years' }).resolved.jobType, 'Full-time Experienced')
  })

  test('degree eligibility retains the explicit employment arrangement: ' + fixture.id, () => {
    assert.equal(classify({ ...fixture.job, sourceEmploymentType: 'Contract' }).resolved.jobType, 'Contract')
    assert.equal(classify({ ...fixture.job, sourceEmploymentType: 'Internship' }).resolved.jobType, 'Intern')
  })
}

const route = "Required qualifications: Bachelor's degree with two years of relevant experience or a Master's degree in a related field with no prior professional experience."
const job = body => ({ title: 'Software Engineer', sourceEmploymentType: 'Full-time', sourceDescription: body })

for (const requirement of [
  'All applicants must have 5 years of professional software-engineering experience.',
  'Prior professional software-engineering experience is required.',
  'Previous employment in software engineering is required.',
]) {
  test('separate mandatory history survives explicit degree waiver: ' + requirement, () => {
    assert.equal(classify(job(route + '\n' + requirement)).resolved.jobType, 'Full-time Experienced')
  })
}

test('a preferred no-work degree route does not waive required professional work', () => {
  assert.equal(classify(job('Required qualifications: Minimum 3 years of professional software-engineering experience.\nPreferred qualifications: A bachelor degree or advanced degree without experience.')).resolved.jobType, 'Full-time Experienced')
})

test('training or recruiting other degree holders does not establish own entry eligibility', () => {
  for (const activity of ['training applicants with', 'recruiting candidates with']) {
    assert.equal(classify(job('Required qualifications: Experience ' + activity + " a bachelor degree and two years of experience or a master's degree with no prior professional experience.")).resolved.jobType, 'Full-time Experienced')
  }
})

test('an advanced degree with relevant exposure alone is not an explicit zero-work waiver', () => {
  assert.equal(classify(job('Required qualifications: 2-4 years of relevant experience or an advanced degree with relevant exposure.')).resolved.jobType, 'Full-time Experienced')
})

test('waiving experience with a particular tool does not establish a general no-work route', () => {
  assert.equal(classify(job("Required qualifications: Bachelor degree with 2 years of experience or a master's degree with no experience with Python.")).resolved.jobType, 'Full-time Experienced')
})

for (const heading of ['Required qualifications:', 'EXPERIENCE AND KNOWLEDGE']) {
  test('advanced-degree tool waiver retains work requirements under ' + heading, () => {
    assert.equal(classify(job(heading + '\nBachelor degree with 2 years of experience or an advanced degree with no experience with Python.')).resolved.jobType, 'Full-time Experienced')
  })
}

for (const [heading, credential] of [
  ['Required qualifications:', "a master's degree"],
  ['Required qualifications:', 'an advanced degree'],
  ['EXPERIENCE AND KNOWLEDGE', 'an advanced degree'],
]) {
  test('teaching other degree holders is an occupational requirement: ' + heading + ' ' + credential, () => {
    assert.equal(classify(job(heading + "\nExperience teaching students with a bachelor's degree and two years of experience or " + credential + ' with no prior professional experience.')).resolved.jobType, 'Full-time Experienced')
  })
}

test('a separate professional-work floor remains mandatory within required qualifications', () => {
  assert.equal(classify(job(route + '\n5 years of professional software-engineering experience.')).resolved.jobType, 'Full-time Experienced')
})

test('a preferred professional-work floor does not remove the explicit zero-work route', () => {
  assert.equal(classify(job(route + '\nPreferred qualifications:\n5 years of professional software-engineering experience.')).resolved.jobType, 'Full-time Fresher')
})

test('a separate academic research requirement remains compatible with the explicit zero-work route', () => {
  assert.equal(classify(job(route + '\n5 years of academic research experience.')).resolved.jobType, 'Full-time Fresher')
})

test('a professional floor restricted to the experience-based route does not apply to the degree route', () => {
  assert.equal(classify(job(route + '\n5 years of professional software-engineering experience only for candidates using the experience-based route.')).resolved.jobType, 'Full-time Fresher')
})

test('typical professional history does not become a mandatory floor for the explicit degree route', () => {
  assert.equal(classify(job(route + '\n5 years of professional software-engineering experience is typical for this role.')).resolved.jobType, 'Full-time Fresher')
})

test('a separate positive fractional professional-work floor still excludes applicants without work', () => {
  assert.equal(classify(job(route + '\n0.5 years of professional software-engineering experience.')).resolved.jobType, 'Full-time Experienced')
})

test('a separate zero-year professional floor remains compatible with the explicit degree route', () => {
  assert.equal(classify(job(route + '\n0 years of professional software-engineering experience.')).resolved.jobType, 'Full-time Fresher')
})
