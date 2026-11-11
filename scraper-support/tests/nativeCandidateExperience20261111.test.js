import assert from 'node:assert/strict'
import test from 'node:test'
import { inferMissingExperienceRequired, normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

// These controlled source records exercise an explicit unresolved-requirement
// contract. They are not captured native vacancies or evidence of no experience.
for (const sourceRecordKind of ['corporate-public-role-card', 'api-role-observation']) {
  const record = {
    source: 'candidate-control', title: 'Talent Acquisition Intern',
    company: 'Controlled publisher', jobId: 'controlled-intern',
    sourceUrl: 'https://control.example/careers', sourceRecordKind,
    sourceExperienceScopeUnresolved: true, skipPublicExperienceEnrichment: true,
    publicExperienceChecked: false, sourceCountryScopeUnresolved: true,
    country: null, employmentType: 'Internship', experienceRequired: null,
  }

  test(sourceRecordKind + ' cannot derive zero experience from its intern title', () => {
    assert.equal(inferMissingExperienceRequired(record, null), null)
  })

  test(sourceRecordKind + ' cannot promote an inferred profile into an unresolved requirement', () => {
    assert.equal(inferMissingExperienceRequired(record, null, {
      confidence: 'high', minimumYears: 0, maximumYears: 0, evidence: 'No experience required',
    }), null)
  })

  test(sourceRecordKind + ' remains unresolved through actual normalization', () => {
    const normalized = normalizeScrapedJob(record, { country: 'India', countryFilter: 'India' })
    assert.equal(normalized.experienceRequired, null)
    assert.equal(normalized.country, null)
    assert.equal(normalized.publicExperienceChecked, false)
    assert.equal(normalized.originalTitle, record.title)
  })

  test(sourceRecordKind + ' retains an explicitly supplied requirement', () => {
    for (const experienceRequired of ['2 years', 'No experience required']) {
      assert.equal(inferMissingExperienceRequired(record, experienceRequired), experienceRequired)
      assert.equal(normalizeScrapedJob({ ...record, experienceRequired }).experienceRequired, experienceRequired)
    }
  })

  test(sourceRecordKind + ' does not alter defaults without both unresolved and skip flags', () => {
    for (const changed of [
      { sourceExperienceScopeUnresolved: false }, { skipPublicExperienceEnrichment: false },
    ]) assert.equal(inferMissingExperienceRequired({ ...record, ...changed }, null), 'No experience required')
  })
}
