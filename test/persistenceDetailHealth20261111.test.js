import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import Job from '../src/models/Job.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'
import { saveToDB } from '../scraper-support/utils/saveToDB.js'
import { generateFingerprint } from '../scraper-support/utils/applicationIdentity.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'
import { buildSourceDescriptionDisplay } from '../src/utils/jobDescriptionDisplay.js'

// Authored local controls. Real persistence and display code run against model
// method stubs; no database, browser, network or model inference is involved.
const source = 'synthetic-detail-health-control'
const now = new Date('2026-11-11T00:00:00.000Z')
const role = (id, fields = {}) => ({ source, jobId: id, title: `Synthetic Engineer ${id}`,
  company: 'Synthetic Employer', country: 'India', location: 'Bengaluru, India',
  sourceUrl: `https://employer.example.test/jobs/${id}`, applyUrl: `https://employer.example.test/jobs/${id}`,
  sourceDescription: 'Build customer services.', ...fields })
const invisible = [
  ['encoded empty markup', '&lt;p&gt;&nbsp;&lt;/p&gt;'],
  ['template-only markup', '<template>Non-visible synthetic wording.</template>'],
  ['hidden markup', '<p hidden>Hidden synthetic wording.</p>'],
  ['encoded placeholder', '&lt;p&gt;Enter the job description...&lt;/p&gt;'],
  ['aria-hidden markup', '<p aria-hidden="true">Hidden synthetic wording.</p>'],
  ['CSS-hidden markup', '<p style="display:none">Hidden synthetic wording.</p>'],
  ['navigation-only markup', '<nav>Synthetic navigation links.</nav>'],
]
const completeHealth = { complete: true, inspectedJobs: 1, incompleteJobs: 0, missingDescriptions: 0, failureKinds: {} }
const missingHealth = { complete: false, inspectedJobs: 1, incompleteJobs: 1, missingDescriptions: 1,
  failureKinds: { 'missing-content': 1 } }

for (const [label, sourceDescription] of invisible) {
  test(`detail health rejects ${label} without changing raw-source eligibility or input`, () => {
    const job = Object.freeze(role('R1', { sourceDescription }))
    const jobs = Object.freeze([job])
    assert.equal(hasSourceDescription(job), true, 'this case must reach the display-aware gap')
    assert.deepEqual(extractionDetailHealth(jobs), missingHealth)
    assert.equal(job.sourceDescription, sourceDescription)
    assert.equal(Object.hasOwn(job, 'description'), false)
  })
}

for (const [label, fields] of [
  ['explicit null before generated fallback', { sourceDescription: null, description: 'Generated display content.' }],
  ['raw placeholder', { sourceDescription: 'Enter job description' }],
  ['raw markup only', { sourceDescription: '<p>&nbsp;<br></p>' }],
]) test(`detail health keeps ${label} incomplete`, () => {
  assert.deepEqual(extractionDetailHealth([role('R1', fields)]), missingHealth)
})

for (const [label, fields] of [
  ['plain source', { sourceDescription: 'Build customer services.' }],
  ['HTML source', { sourceDescription: '<p>Build customer services.</p>' }],
  ['short source', { sourceDescription: 'Go' }],
  ['legacy jobDescription', { sourceDescription: undefined, jobDescription: 'Maintain APIs.' }],
  ['legacy description', { sourceDescription: undefined, description: 'Maintain APIs.' }],
]) test(`detail health preserves ${label} completeness`, () => {
  assert.deepEqual(extractionDetailHealth([role('R1', fields)]), completeHealth)
})

const malformed = '<p title="unterminated>Develop APIs.</p>'
test('a real formatter rejection becomes missing detail without escaping or changing input', () => {
  const job = Object.freeze(role('R1', { sourceDescription: malformed }))
  assert.equal(hasSourceDescription(job), true)
  assert.throws(() => buildSourceDescriptionDisplay(malformed), { name: 'ActiveNativeContentError' })
  assert.deepEqual(extractionDetailHealth(Object.freeze([job])), missingHealth)
  assert.equal(job.sourceDescription, malformed)
})

function persistence(t, existing = null) {
  assert.equal(mongoose.connection.readyState, 0)
  assert.equal(mongoose.connection.db, undefined)
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState')
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 })
  t.after(() => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor)
    else delete mongoose.connection.readyState
    assert.equal(mongoose.connection.db, undefined)
  })
  t.mock.method(mongoose, 'connect', () => assert.fail('Actual database connection forbidden'))
  t.mock.method(globalThis, 'fetch', () => assert.fail('Network and remote model inference forbidden'))
  t.mock.method(Job, 'find', () => ({ select() { return this }, lean() { return this },
    exec: async () => existing ? [structuredClone(existing)] : [] }))
  const writes = [], cleanup = [], stages = []
  const unseen = { jobId: 'UNSEEN', status: 'active', missedScrapeCount: 2 }
  const originalUnseen = structuredClone(unseen)
  t.mock.method(Job, 'bulkWrite', async operations => {
    writes.push(...operations)
    return { upsertedCount: existing ? 0 : operations.length, modifiedCount: existing ? operations.length : 0 }
  })
  t.mock.method(Job, 'deleteMany', filter => {
    cleanup.push({ operation: 'delete', filter })
    return { exec: async () => { unseen.status = 'deleted'; return { deletedCount: 1 } } }
  })
  t.mock.method(Job, 'updateMany', (filter, update) => {
    cleanup.push({ operation: 'miss', filter, update })
    return { exec: async () => { unseen.missedScrapeCount++; return { modifiedCount: 1 } } }
  })
  const run = (jobs, options = {}) => saveToDB(jobs, source, { now,
    enrichPublicExperience: false, descriptionRewriteMode: 'off', replaceExisting: true,
    refreshDatasetSummary: false, enqueueAlerts: false, missesBeforeExpiry: 3,
    lifecycleAttemptId: 'synthetic-attempt', onStage: event => stages.push(event), ...options })
  return { run, writes, cleanup, stages, unseen, originalUnseen }
}

function held(state, result) {
  assert.deepEqual(state.cleanup, [], 'neither deleteMany nor updateMany may be admitted')
  assert.deepEqual(state.unseen, state.originalUnseen)
  assert.equal(result.staleCheckSkipped, true)
  assert.deepEqual([result.deleted, result.expired, result.missed], [0, 0, 0])
  assert.equal(state.stages.some(event => ['expireUnseen', 'recordMisses'].includes(event.stage)), false)
}

for (const mode of ['off', 'publish']) for (const [label, sourceDescription] of invisible.slice(0, 4)) {
  test(`${mode} new unflagged ${label} cannot admit deletion or lifecycle misses`, async t => {
    const state = persistence(t)
    const input = role('R1', { sourceDescription, sourceExperienceRequired: '0-1 Years',
      minimumQualification: 'Bachelor of Engineering', sourceEmploymentType: 'Permanent' })
    const original = structuredClone(input)
    const result = await state.run([input], { descriptionRewriteMode: mode })
    held(state, result)
    assert.match(result.staleCheckReason, /Incomplete source role details/)
    assert.equal(result.eligibleJobs, 1)
    assert.equal(result.filteredEmptyDescription, 0)
    assert.equal(state.writes.length, 1, 'the new lifecycle hold must not reject an eligible upsert')
    const stored = state.writes[0].updateOne.update.$set
    assert.equal(stored.sourceDescription, null, 'the separate policy repair canonicalizes rendered-empty new source')
    assert.equal(Object.hasOwn(stored, 'description'), false)
    assert.equal(stored.descriptionRewrite.status, 'skipped')
    assert.equal(stored.descriptionRewrite.reason, 'insufficient_source')
    assert.equal(stored.sourceExperienceRequired, '0-1 Years')
    assert.equal(stored.minimumQualification, 'Bachelor of Engineering')
    assert.equal(stored.sourceEmploymentType, 'Permanent')
    assert.deepEqual(input, original)
  })
}

test('a genuine current role cannot conceal an unflagged rendered-empty India role', async t => {
  const state = persistence(t)
  const result = await state.run([role('REAL'), role('MISSING', { sourceDescription: '&lt;p&gt;&nbsp;&lt;/p&gt;' })])
  held(state, result)
  assert.equal(result.eligibleJobs, 2)
  assert.equal(state.writes.length, 2)
  assert.equal(state.writes[0].updateOne.update.$set.sourceDescription, 'Build customer services.')
  assert.equal(state.writes[1].updateOne.update.$set.sourceDescription, null)
})

test('a preserved prior description does not authorize cleanup after missing current detail', async t => {
  const prior = role('R1', { sourceDescription: 'Previously verified employer text.',
    description: '## Previously published text', descriptionFormat: 'markdown',
    sourceContentHashVersion: 2, sourceContentHash: 'a'.repeat(64),
    descriptionRewrite: { status: 'published', inputHash: 'a'.repeat(64) } })
  prior.fingerprint = generateFingerprint(prior)
  const original = structuredClone(prior)
  const state = persistence(t, prior)
  const result = await state.run([role('R1', { sourceDescription: '<template>Non-visible synthetic wording.</template>' })],
    { descriptionRewriteMode: 'publish' })
  held(state, result)
  const update = state.writes[0].updateOne.update
  for (const key of ['sourceDescription', 'description', 'descriptionFormat', 'sourceContentHash', 'descriptionRewrite']) {
    assert.equal(Object.hasOwn(update.$set, key), false, `previous ${key} must survive the upsert`)
    assert.equal(Object.hasOwn(update.$unset || {}, key), false)
  }
  assert.deepEqual(prior, original)
})

for (const mode of ['off', 'publish']) for (const [label, sourceDescription, description, descriptionFormat] of [
  ['plain', 'Build APIs.', 'Build APIs.', 'plain'],
  ['HTML', '<p>Build APIs.</p>', 'Build APIs.', 'markdown'],
  ['short', 'Go', 'Go', 'plain'],
]) test(`${mode} genuine ${label} content retains its normal writes and exact cleanup filters`, async t => {
  const state = persistence(t)
  const result = await state.run([role('R1', { sourceDescription })], { descriptionRewriteMode: mode })
  assert.equal(result.staleCheckSkipped, false)
  assert.equal(result.eligibleJobs, 1)
  assert.equal(state.writes.length, 1)
  const stored = state.writes[0].updateOne.update.$set
  assert.equal(stored.sourceDescription, sourceDescription)
  assert.equal(stored.description, description)
  assert.equal(stored.descriptionFormat, descriptionFormat)
  assert.equal(stored.descriptionRewrite.status, mode === 'publish' ? 'pending' : 'skipped')
  const unseenFilter = { source, status: 'active', fingerprint: { $nin: [stored.fingerprint] },
    lastMissedScrapeRunId: { $ne: 'synthetic-attempt' } }
  assert.deepEqual(state.cleanup, [
    { operation: 'delete', filter: { ...unseenFilter, missedScrapeCount: { $gte: 2 } } },
    { operation: 'miss', filter: unseenFilter, update: { $inc: { missedScrapeCount: 1 },
      $set: { lastMissedScrapeRunId: 'synthetic-attempt' } } },
  ])
  assert.deepEqual([result.deleted, result.expired, result.missed], [1, 1, 2])
})

for (const [label, fields] of [
  ['listing hold', { sourceListingComplete: false }],
  ['detail hold', { sourceDetailComplete: false }],
  ['cleanup hold', { lifecycleCleanupAllowed: false }],
]) test(`genuine source cannot override an explicit ${label}`, async t => {
  const state = persistence(t)
  const result = await state.run([role('R1', fields)])
  held(state, result)
  assert.equal(state.writes.length, 1)
})

test('foreign missing display does not broaden the India detail gate', async t => {
  const state = persistence(t)
  const result = await state.run([role('R1'), role('FOREIGN', { country: 'United Kingdom',
    location: 'London, United Kingdom', sourceDescription: '<template>Inert synthetic text.</template>' })])
  assert.equal(result.staleCheckSkipped, false)
  assert.equal(result.filteredNonIndia, 1)
  assert.equal(state.writes.length, 1)
  assert.deepEqual(state.cleanup.map(entry => entry.operation), ['delete', 'miss'])
})

test('an explicit foreign detail hold still applies to the whole source', async t => {
  const state = persistence(t)
  const result = await state.run([role('R1'), role('FOREIGN', { country: 'United Kingdom',
    location: 'London, United Kingdom', sourceDetailComplete: false })])
  held(state, result)
  assert.equal(result.filteredNonIndia, 1)
})

test('malformed formatter input rejects persistence before any mocked write or cleanup', async t => {
  const state = persistence(t)
  await assert.rejects(state.run([role('R1', { sourceDescription: malformed })]), { name: 'ActiveNativeContentError' })
  assert.deepEqual(state.writes, [])
  assert.deepEqual(state.cleanup, [])
  assert.deepEqual(state.unseen, state.originalUnseen)
})

test('authoritativeEmpty cannot override rendered-empty enumerated role details', async t => {
  const state = persistence(t)
  const result = await state.run([role('R1', { sourceDescription: '&lt;p&gt;&nbsp;&lt;/p&gt;' })], { authoritativeEmpty: true })
  held(state, result)
  assert.equal(result.eligibleJobs, 1)
})
