import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { planPublishingGapRollout } from '../scripts/publishPublishingGapRepairs.js'
import * as rollout from '../scripts/publishPublishingGapRepairs.js'

const fixtures = () => {
  const trials = Array.from({ length: 50 }, (_, i) => ({ source: `source${String(i).padStart(2, '0')}`, jobs: [{}] }))
  return { trials, validation: { environment: 'temporary-local-mongodb', passedSources: 50,
    rows: trials.map(t => ({ source: t.source, outcome: 'passed', visibleJobs: 1, idempotent: true,
      trialHash: createHash('sha256').update(JSON.stringify(t)).digest('hex') })) } }
}
test('rollout requires all 50 locally validated sources and splits into five batches of ten', () => {
  const plan = planPublishingGapRollout(fixtures())
  assert.equal(plan.batches.length, 5)
  assert.deepEqual(plan.batches[0], ['source00', 'source01', 'source02', 'source03', 'source04', 'source05', 'source06', 'source07', 'source08', 'source09'])
  assert.equal(plan.batches[4][9], 'source49')
  const input = fixtures()
  input.validation.rows[49].outcome = 'needs-investigation'
  assert.throws(() => planPublishingGapRollout(input), /validation/i)
})
test('a successful validation for a different source cannot authorize the rollout', () => {
  const input = fixtures()
  input.trials[49].source = 'unvalidated'
  assert.throws(() => planPublishingGapRollout(input), /validation/i)
  assert.throws(() => planPublishingGapRollout({ ...fixtures(), trials: fixtures().trials.slice(0, 49) }), /50/)
})

test('changing jobs after local validation invalidates rollout eligibility', () => {
  const input = fixtures()
  input.trials[0].jobs.push({ title: 'An untested replacement' })
  assert.throws(() => planPublishingGapRollout(input), /validation|changed/i)
})

test('later reviewed releases support a final partial batch without weakening validation', () => {
  const input = fixtures()
  input.trials = input.trials.slice(0, 13)
  input.validation.rows = input.validation.rows.slice(0, 13)
  input.validation.passedSources = 13
  const plan = planPublishingGapRollout({ ...input, expectedSources: 13 })
  assert.deepEqual(plan.batches.map(batch => batch.length), [10, 3])
  assert.equal(plan.sourceCount, 13)
  assert.throws(() => planPublishingGapRollout({ ...input, expectedSources: 14 }), /14|validation/i)
})

const now = new Date('2026-10-21T12:00:00Z')
const nativeTrial = () => ({
  source: 'native-source', completedAt: '2026-10-21T11:00:00Z',
  outcome: 'complete-positive-extraction', mode: 'browser-captured-live-http-replay', productionWrites: false,
  jobs: [{ source: 'native-source', title: 'Software Engineer', jobDescription: 'Build reliable production software services.' }],
  inventoryEvidence: {
    status: 'complete-inventory', firstParty: true, listingComplete: true, pagesFetched: 1,
    surface: 'https://careers.example.test/jobs', reportedTotal: 1, indiaFacetCount: 1,
    verifiedAt: '2026-10-21T10:59:00Z',
  },
})

test('successful trial gate accepts legacy success and the explicit native replay format', () => {
  assert.equal(typeof rollout.isSuccessfulPublishingGapTrial, 'function')
  const native = nativeTrial()
  assert.equal(rollout.isSuccessfulPublishingGapTrial(native, { source: 'native-source', now }), true)
  const legacy = { source: native.source, jobs: native.jobs, inventoryEvidence: native.inventoryEvidence, result: { success: true } }
  assert.equal(rollout.isSuccessfulPublishingGapTrial(legacy, { source: 'native-source', now }), true)
})

test('native replay markers cannot admit an arbitrary success-missing or contradictory trial', () => {
  assert.equal(typeof rollout.isSuccessfulPublishingGapTrial, 'function')
  for (const overrides of [
    { outcome: undefined }, { outcome: 'extraction-failed' }, { outcome: 'positive-extraction-incomplete-evidence' },
    { mode: undefined }, { mode: 'fixture-replay' }, { productionWrites: undefined }, { productionWrites: true },
    { result: { success: false } }, { result: { softFailure: true } },
  ]) {
    assert.equal(rollout.isSuccessfulPublishingGapTrial({ ...nativeTrial(), ...overrides },
      { source: 'native-source', now }), false, JSON.stringify(overrides))
  }
})

test('isolated direct live audits retain the same successful extraction requirements', () => {
  const trial = { ...nativeTrial(), mode: 'isolated-direct-live-extraction-no-database' }
  assert.equal(rollout.isSuccessfulPublishingGapTrial(trial, { source: trial.source, now }), true)
  assert.equal(rollout.isSuccessfulPublishingGapTrial({ ...trial, productionWrites: true }, { source: trial.source, now }), false)
  assert.equal(rollout.isSuccessfulPublishingGapTrial({ ...trial, outcome: 'unverified-zero' }, { source: trial.source, now }), false)
})

test('actual Node HTTP captures retain their truthful mode and the complete extraction gate', () => {
  const trial = { ...nativeTrial(), mode: 'captured-live-public-http-extraction-no-database' }
  assert.equal(rollout.isSuccessfulPublishingGapTrial(trial, { source: trial.source, now }), true)
  for (const overrides of [
    { productionWrites: true }, { outcome: 'positive-extraction-incomplete-evidence' },
    { inventoryEvidence: { ...trial.inventoryEvidence, listingComplete: false } },
    { jobs: [{ ...trial.jobs[0], sourceDetailComplete: false }] },
    { result: { success: false } }, { result: { softFailure: true } },
  ]) assert.equal(rollout.isSuccessfulPublishingGapTrial({ ...trial, ...overrides }, { source: trial.source, now }), false)
})

test('both trial formats retain source, nonempty job and fresh complete evidence requirements', () => {
  assert.equal(typeof rollout.isSuccessfulPublishingGapTrial, 'function')
  for (const format of ['native', 'legacy']) {
    const trial = nativeTrial()
    if (format === 'legacy') {
      delete trial.outcome
      delete trial.mode
      delete trial.productionWrites
      trial.result = { success: true }
    }
    for (const overrides of [
      { source: 'different-source' }, { source: '' }, { jobs: [] }, { jobs: null }, { jobs: [null] },
      { jobs: [{ source: 'different-source', title: 'Engineer' }] },
      { jobs: [{ source: 'native-source', title: 'Engineer', sourceListingComplete: false }] },
      { jobs: [{ ...trial.jobs[0], sourceDetailComplete: false }] },
      { jobs: [{ ...trial.jobs[0], jobDescription: '<p></p>' }] },
      { inventoryEvidence: null },
      { inventoryEvidence: { ...trial.inventoryEvidence, status: 'verified-empty', reportedTotal: 0, indiaFacetCount: 0 } },
      ...[
        { listingComplete: false }, { firstParty: false }, { status: 'discovery-only' }, { pagesFetched: 0 },
        { surface: 'file:///jobs' }, { verifiedAt: '2026-10-01T00:00:00Z' }, { verifiedAt: '2026-10-22T00:00:00Z' },
      ].map(evidence => ({ inventoryEvidence: { ...trial.inventoryEvidence, ...evidence } })),
    ]) {
      assert.equal(rollout.isSuccessfulPublishingGapTrial({ ...trial, ...overrides },
        { source: 'native-source', now }), false, `${format}: ${JSON.stringify(overrides)}`)
    }
  }
})

test('accepted native trials still require matching passing local validation and an unchanged hash', () => {
  assert.equal(typeof rollout.isSuccessfulPublishingGapTrial, 'function')
  const trial = nativeTrial()
  assert.equal(rollout.isSuccessfulPublishingGapTrial(trial, { source: trial.source, now }), true)
  const validation = { environment: 'temporary-local-mongodb', passedSources: 1, rows: [{
    source: trial.source, outcome: 'passed', visibleJobs: 1, idempotent: true,
    trialHash: createHash('sha256').update(JSON.stringify(trial)).digest('hex'),
  }] }
  const input = { trials: [trial], validation, expectedSources: 1 }
  assert.deepEqual(planPublishingGapRollout(input).batches, [['native-source']])
  assert.throws(() => planPublishingGapRollout({ ...input, validation: null }), /validation/i)
  assert.throws(() => planPublishingGapRollout({ ...input,
    validation: { ...validation, rows: [{ ...validation.rows[0], outcome: 'needs-investigation' }] },
  }), /validation/i)
  trial.jobs[0].title = 'Changed after validation'
  assert.throws(() => planPublishingGapRollout(input), /changed after local validation/i)
})
