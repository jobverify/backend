import assert from 'node:assert/strict'
import test from 'node:test'
import * as disclosures from '../src/utils/employerDisclosures.js'

test('public detail adds employer disclosures after preserving numeric experience and inferred classification', () => {
  const input = Object.freeze({ title: 'Manager Growth', description: 'Lead growth. Bring 3 to 5 years of experience.',
    descriptionFormat: 'plain', sourceDescription: '<p>Bring 3 to 5 years of experience.</p>',
    experienceLevel: 'Mid Level', seniority: 'Manager', experienceProfile: { minimumYears: 3, maximumYears: 5 },
    employerExperienceLevel: 'Entry Level', employerStreetAddress: 'Veritas Building' })
  const result = disclosures.withEmployerDisclosures?.(input)
  assert.equal(result?.description, 'Lead growth. Bring 3 to 5 years of experience.\n\nEmployer role classification: Entry Level\n\nEmployer work address: Veritas Building')
  assert.equal(result.experienceLevel, 'Mid Level')
  assert.equal(result.seniority, 'Manager')
  assert.deepEqual(result.experienceProfile, { minimumYears: 3, maximumYears: 5 })
  assert.equal(result.sourceDescription, input.sourceDescription)
  assert.equal(input.description, 'Lead growth. Bring 3 to 5 years of experience.')
  assert.notEqual(result, input)
})

test('card DTO retains typed disclosures without inventing a description', () => {
  const input = { title: 'Manager Growth', employerExperienceLevel: 'Entry Level', employerStreetAddress: 'Veritas Building' }
  assert.deepEqual(disclosures.withEmployerDisclosures?.(input), input)
  assert.equal(Object.hasOwn(input, 'description'), false)
})

test('legacy DTOs without disclosures keep their existing response shape', () => {
  const input = { title: 'Legacy role', description: 'Existing description.' }
  assert.deepEqual(disclosures.withEmployerDisclosures?.(input), input)
})

test('malformed disclosures are not coerced into applicant-facing facts', () => {
  const result = disclosures.withEmployerDisclosures?.({ description: 'Existing description.',
    employerExperienceLevel: { label: 'Entry Level' }, employerStreetAddress: 123 })
  assert.deepEqual(result, { description: 'Existing description.', employerExperienceLevel: null, employerStreetAddress: null })
})

test('missing and blank descriptions do not become metadata-only job descriptions', () => {
  for (const description of [undefined, null, '', '   ']) {
    const input = { description, employerExperienceLevel: 'Executive' }
    assert.deepEqual(disclosures.withEmployerDisclosures?.(input), input)
  }
})

test('repeated DTO formatting does not duplicate the employer disclosure lines', () => {
  const input = { description: 'Role details.', descriptionFormat: 'markdown', employerExperienceLevel: 'Executive' }
  const first = disclosures.withEmployerDisclosures?.(input)
  assert.equal(first?.description, 'Role details.\n\nEmployer role classification: Executive')
  assert.deepEqual(disclosures.withEmployerDisclosures?.(first), first)
})

test('display formatting keeps literal employer text and collapses multiline values into their own labeled fact', () => {
  const result = disclosures.withEmployerDisclosures?.({ description: 'Role details.',
    employerExperienceLevel: ' Entry\nLevel ', employerStreetAddress: ' 1 <North> & Road\nUnit 2 ' })
  assert.equal(result?.employerExperienceLevel, 'Entry\nLevel')
  assert.equal(result.employerStreetAddress, '1 <North> & Road\nUnit 2')
  assert.equal(result.description, 'Role details.\n\nEmployer role classification: Entry Level\n\nEmployer work address: 1 <North> & Road Unit 2')
})
