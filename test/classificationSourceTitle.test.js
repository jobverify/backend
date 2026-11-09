import test from 'node:test'
import assert from 'node:assert/strict'
import { buildClassificationInput } from '../src/services/jobClassificationPolicy.js'
import { postScrapeInput, sourceGuardedClassification, sourceSnapshotFilter, GLICLASS_IDENTITY } from '../src/services/postScrapeClassification.js'
import { trialNativeInputHash } from '../scripts/trialNativePredictionCache.js'

const now = new Date('2026-10-11T00:00:00Z')
const contaminated = {
  title: 'Backend Developer Job Summary ' + 'CSS body { color: black } var DV_LANGUAGE = en_us; '.repeat(150),
  sourceUrl: 'https://employer.applytojob.com/apply/ABC123def4/Backend-Developer-Noida',
  sourceDescription: 'This is a contract position requiring five years of professional experience. Build backend applications.',
  sourceEmploymentType: 'Contract',
}

test('overcaptured ATS title is recovered without changing the source body or original record', () => {
  const before = structuredClone(contaminated)
  const input = postScrapeInput(contaminated, { now })
  const original = buildClassificationInput(contaminated, { now, identity: GLICLASS_IDENTITY })
  assert.equal(input.title, 'Backend Developer Noida')
  assert.equal(input.body, original.body)
  assert.deepEqual(contaminated, before)
  assert.equal(input.sourceTitleRecovery.sourceField, 'sourceUrl')
  assert.equal(input.sourceTitleRecovery.provider, 'JazzHR')
  const classification = sourceGuardedClassification(contaminated, { now })
  assert.equal(classification.resolved.jobType, 'Contract')
  assert.ok(classification.sourceGuards.includes('overcaptured_title_recovered_from_ats_url'))
  assert.equal(classification.sourceTitleRecovery.recoveredTitle, input.title)
})

test('ordinary titles keep the exact native input and lookalike ATS URLs cannot supply a title', () => {
  const ordinary = { ...contaminated, title: 'Backend Developer' }
  assert.deepEqual(postScrapeInput(ordinary, { now }), buildClassificationInput(ordinary, { now, identity: GLICLASS_IDENTITY }))
  const wrongHost = { ...contaminated, sourceUrl: 'https://employer.applytojob.com.example.org/apply/ABC123def4/Invented-Role' }
  assert.equal(postScrapeInput(wrongHost, { now }).title, buildClassificationInput(wrongHost, { now, identity: GLICLASS_IDENTITY }).title)
  assert.equal(postScrapeInput(wrongHost, { now }).sourceTitleRecovery, undefined)
})

test('raw source changes invalidate derived provenance while an unchanged recovered native input is reusable', () => {
  const input = postScrapeInput(contaminated, { now })
  const changed = postScrapeInput({ ...contaminated, title: contaminated.title + ' extra source text' }, { now })
  assert.notEqual(changed.inputHash, input.inputHash)
  assert.equal(trialNativeInputHash(changed), trialNativeInputHash(input))
  const newRole = postScrapeInput({ ...contaminated, sourceUrl: 'https://employer.applytojob.com/apply/ABC123def4/Frontend-Developer-Noida' }, { now })
  assert.notEqual(trialNativeInputHash(newRole), trialNativeInputHash(input))
  const filter = sourceSnapshotFilter({ _id: 'fixture', ...contaminated })
  assert.ok(filter.$and.some(part => part.sourceUrl?.$eq === contaminated.sourceUrl))
})

test('iCIMS narrative titles recover the employer role slug without altering the description', () => {
  for (const [prefix, slug, expected] of [
    ['Key Responsibilities: ', 'servicenow-developer', 'servicenow developer'],
    ['Success Measures: ', 'principal-cyber-security-test-engineer', 'principal cyber security test engineer'],
  ]) {
    const job = { title: prefix + 'Full employer narrative. '.repeat(230),
      applyUrl: `https://careers-oneadvanced.icims.com/jobs/8810/${slug}/null`,
      sourceDescription: 'Build secure applications. Five years of professional experience required.' }
    const before = structuredClone(job)
    const input = postScrapeInput(job, { now })
    assert.equal(input.title, expected)
    assert.equal(input.body, buildClassificationInput(job, { now, identity: GLICLASS_IDENTITY }).body)
    assert.equal(input.sourceTitleRecovery.provider, 'iCIMS')
    assert.equal(input.sourceTitleRecovery.sourceField, 'applyUrl')
    assert.deepEqual(job, before)
    const changed = postScrapeInput({ ...job, applyUrl: job.applyUrl.replace(slug, 'different-role') }, { now })
    assert.notEqual(changed.inputHash, input.inputHash)
    assert.notEqual(trialNativeInputHash(changed), trialNativeInputHash(input))
    assert.ok(sourceSnapshotFilter({ _id: 'fixture', ...job }).$and.some(part => part.applyUrl?.$eq === job.applyUrl))
  }
})

test('iCIMS recovery rejects ordinary titles, unrelated paths and untrusted or invalid slugs', () => {
  const base = { title: 'Success Measures: ' + 'Employer narrative. '.repeat(100) }
  for (const url of [
    'https://icims.com.example.org/jobs/8810/false-role/null',
    'http://careers.example.icims.com/jobs/8810/false-role/null',
    'https://user:password@careers.example.icims.com/jobs/8810/false-role/null',
    'https://careers.example.icims.com/jobs/not-a-job-id/false-role/null',
    'https://careers.example.icims.com/jobs/8810/false-role/apply',
    'https://careers.example.icims.com/jobs/8810/%3Cscript%3E/null',
    'https://careers.example.icims.com/jobs/8810/role%0Atext/null',
    'https://careers.example.icims.com/jobs/8810/%E0%A4%A/null',
    `https://careers.example.icims.com/jobs/8810/${'role'.repeat(100)}/null`,
  ]) assert.equal(postScrapeInput({ ...base, applyUrl: url }, { now }).sourceTitleRecovery, undefined)
  const ordinary = { ...base, title: 'ServiceNow Developer', applyUrl: 'https://careers.example.icims.com/jobs/8810/false-role/null' }
  assert.deepEqual(postScrapeInput(ordinary, { now }), buildClassificationInput(ordinary, { now, identity: GLICLASS_IDENTITY }))
})
