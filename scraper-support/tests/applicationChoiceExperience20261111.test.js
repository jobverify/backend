import assert from 'node:assert/strict'
import test from 'node:test'
import { inferMissingExperienceRequired, normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

// Controlled application-choice records test the opt-in data contract. They
// are neither captured native vacancies nor evidence of a source requirement.
const unresolvedChoice = {
  source: 'application-choice-control', title: 'UX Intern',
  company: 'Controlled publisher', jobId: 'controlled-ux-intern',
  sourceUrl: 'https://control.example/careers',
  sourceRecordKind: 'application-role-choice', sourceExperienceScopeUnresolved: true,
  skipPublicExperienceEnrichment: true, publicExperienceChecked: false,
  sourceCountryScopeUnresolved: true, country: null,
  employmentType: 'Internship', experienceRequired: null, jobDescription: null,
}

test('an unresolved application choice cannot acquire zero experience from an internship label', () => {
  assert.equal(inferMissingExperienceRequired(unresolvedChoice, null), null)
})

test('an unresolved application choice cannot acquire requirements from an inferred profile', () => {
  for (const profile of [
    { minimumYears: 0, maximumYears: 0, confidence: 'high', evidence: 'No experience required' },
    { minimumYears: 3, maximumYears: 5, confidence: 'high', evidence: '3-5 years' },
  ]) assert.equal(inferMissingExperienceRequired(unresolvedChoice, null, profile), null)
})

test('actual normalization keeps missing requirements for an unresolved intern application choice', () => {
  const normalized = normalizeScrapedJob(unresolvedChoice, { country: 'India', countryFilter: 'India' })
  assert.equal(normalized.experienceRequired, null)
  assert.equal(normalized.jobDescription, null)
  assert.equal(normalized.country, null)
  assert.equal(normalized.publicExperienceChecked, false)
})

test('an explicit requirement is retained even when an application choice carries the unresolved marker', () => {
  for (const explicit of ['2 years', 'No experience required']) {
    assert.equal(inferMissingExperienceRequired(unresolvedChoice, explicit), explicit)
    assert.equal(normalizeScrapedJob({ ...unresolvedChoice, experienceRequired: explicit }).experienceRequired, explicit)
  }
})

test('ordinary internship inference keeps its existing behavior without the complete opt-in contract', () => {
  for (const changed of [
    { sourceExperienceScopeUnresolved: false },
    { sourceRecordKind: 'vacancy' },
    { skipPublicExperienceEnrichment: false },
  ]) assert.equal(inferMissingExperienceRequired({ ...unresolvedChoice, ...changed }, null), 'No experience required')
  assert.equal(inferMissingExperienceRequired({ title: 'UX Intern', employmentType: 'Internship' }, null), 'No experience required')
})
