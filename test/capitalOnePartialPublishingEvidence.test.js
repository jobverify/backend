import fs from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { fixture, original, referenceClock, readEvidence, gateURL, backendURL, canonical } from './fixtures/capitalOne/partialProof001Fixture.mjs'

const gate = await import(gateURL)
const { analyzePublishableJobs } = await import(new URL('scraper-support/utils/publishableJobMetrics.js', backendURL))
const parentFsReader = fs.readFileSync, parentWorker = Worker
const historicalChild = new URL('./fixtures/capitalOne/partialProof001HistoricalRuleChild.mjs', import.meta.url)
const unhookedChild = new URL('./fixtures/capitalOne/partialProof001UnhookedChild.mjs', import.meta.url)
const compatibilityChild = new URL('./fixtures/capitalOne/partialProof001CurrentCompatibilityChild.mjs', import.meta.url)

function runChild(url, { modeledOutcomes = false } = {}) {
  const result = spawnSync(process.execPath, [fileURLToPath(url)], { encoding: 'utf8', windowsHide: true, timeout: 90_000, maxBuffer: 8 * 1024 * 1024 })
  assert.ifError(result.error)
  let report
  try { report = JSON.parse(result.stdout) } catch { assert.fail('Isolated fixture child did not return JSON: ' + result.stderr + '\n' + result.stdout) }
  if (!modeledOutcomes || !report.results) assert.equal(result.status, 0, result.stderr + '\n' + result.stdout)
  return report
}
async function actualAdmissionIsClosed() {
  const options = { source: 'capitalone', httpEvidence: fixture.httpEvidence, readEvidence }
  await assert.rejects(() => gate.deriveCapitalOnePartialEvidence({ ...options, now: referenceClock }), /current code differs from independent review/)
  await assert.rejects(() => gate.deriveCapitalOnePartialEvidence({ ...options, now: new Date() }), /fresh original native capture required/)
}
let modelPromise
function historicalModel() {
  return modelPromise ??= (async () => {
    await actualAdmissionIsClosed()
    const report = runChild(historicalChild, { modeledOutcomes: true })
    assert.equal(report.kind, 'non-authoritative-controlled-historical-rule-prototype')
    assert.equal(report.publishingAllowed, false)
    assert.equal(report.currentAvailabilityProven, false)
    assert.equal(report.actualHistoricalPolicyRecovered, false)
    assert.equal(report.archivedCodeExecuted, false)
    assert.equal(report.realCollectorRun, false)
    assert.equal(report.nativeExpiryRenewed, false)
    assert.equal(report.unitCases, 16)
    assert.equal(new Set(report.results.map(row => row.id)).size, 16)
    assert.deepEqual(report.results.map(row => row.id), Array.from({ length: 16 }, (_value, index) => index + 1))
    assert.equal(report.controls.length, 5)
    assert.equal(report.stats.replacements.length, 3)
    assert.equal(new Set(report.stats.loads).size, 3)
    assert.equal(report.unrelatedActualPolicyEligible, 6)
    await actualAdmissionIsClosed()
    assert.equal(fs.readFileSync, parentFsReader)
    assert.equal(Worker, parentWorker)
    return report
  })()
}
const originalCases = [
  'exact31 responses qualify all12 original roles with partial company health and unknown employers',
  'dropped job rejects', 'wrong country rejects', 'wrong source rejects', 'invented employer rejects',
  'refreshed posting date rejects', 'truncated cap rejects', 'complete health rejects',
  'whole India total rejects', 'false success rejects', 'source cleanup flag rejects',
  'altered clock rejects', 'wrong native apply rejects',
  'raw evidence, duplicate receipt and path escape fail closed',
  'stale native capture is not renewed by a new trial timestamp',
  'freezer preserves all original jobs and never overwrites a frozen release',
]
// These16 retain the original rule/tamper/freshness/writer semantics. The
// receipt-byte/replay/policy inputs are modeled in a disposable child only.
for (const [index, name] of originalCases.entries()) test('non-authoritative historical-rule unit: ' + name, async () => {
  const report = await historicalModel(), row = report.results.find(value => value.id === index + 1)
  assert.ok(row)
  assert.equal(row.pass, true, row.error?.stack || row.error?.message)
  assert.equal(row.pairedValidBaseline, true)
})
for (const name of ['current-byte corruption', 'worker response count30', 'worker dropped job', 'worker changed country', 'controlled policy6']) test('non-authoritative modeled-edge guard: ' + name, async () => {
  const report = await historicalModel(), row = report.controls.find(value => value.name === name)
  assert.ok(row)
  assert.equal(row.pass, true, row.error?.stack || row.error?.message)
  assert.equal(row.pairedValidBaseline, true)
})
test('isolated historical child leaves real parent001 current-seal and expiry admission closed', async () => {
  await historicalModel()
  await actualAdmissionIsClosed()
  assert.equal(fs.readFileSync, parentFsReader)
  assert.equal(Worker, parentWorker)
})
test('fresh unhooked child also rejects001 current seal and expired native evidence', () => {
  const report = runChild(unhookedChild)
  assert.equal(report.hookRegistration, false)
  assert.equal(report.publishingAllowed, false)
  assert.match(report.oldClockReason, /current code differs from independent review/)
  assert.match(report.expiredReason, /fresh original native capture required/)
})
test('the real gate rejects unit-written freezer output without accepting its modeled eligible branch', async () => {
  const report = await historicalModel(), bytes = fs.readFileSync(report.unitOutput.trialPath), trial = JSON.parse(bytes)
  assert.equal(canonical(trial.jobs), canonical(original.jobs))
  assert.equal(trial.attemptedAt, original.attemptedAt)
  assert.equal(trial.completedAt, original.completedAt)
  await assert.rejects(() => gate.verifyCapitalOnePartialPublishingTrial({ trial, bytes, readEvidence, now: referenceClock }), /current code differs from independent review/)
  await assert.rejects(() => gate.verifyCapitalOnePartialPublishingTrial({ trial, bytes, readEvidence, now: new Date() }), /fresh original native capture required/)
})
test('actual current policy yields6 eligible and6 old immutable roles at the unchanged original clock', () => {
  const result = analyzePublishableJobs(original.jobs, { now: referenceClock })
  assert.equal(result.eligibleJobs.length, 6)
  assert.equal(result.filterCounts.old, 6)
  assert.deepEqual(result.eligibleJobs.map(row => row.requisitionId), ['R1000787', 'R1004124', 'R1003791', 'R999362', 'R249175', 'R1000097'])
})
test('ordinary current collector31-packet compatibility is non-publishing:12 rows,144 additions and actual policy6/6', () => {
  const report = runChild(compatibilityChild)
  assert.equal(report.kind, 'capitalone-historical-native-current-code-compatibility-v1')
  assert.equal(report.approvalGranted, false)
  assert.equal(report.publishingAllowed, false)
  assert.equal(report.currentAvailabilityProven, false)
  assert.equal(report.nativeExpiryRenewed, false)
  assert.equal(report.requestsUsed, 31)
  assert.equal(report.returnedJobs, 12)
  assert.equal(report.oldFieldChanges, 0)
  assert.equal(report.additiveValues, 144)
  assert.equal(report.additiveClasses, 12)
  assert.equal(report.immutablePolicyEligible, 6)
  assert.equal(report.immutablePolicyOld, 6)
  assert.equal(report.currentPolicyEligible, 6)
  assert.equal(report.currentPolicyOld, 6)
  assert.equal(report.originalNativeExpiry, '2026-10-23T01:55:16.783Z')
  assert.equal(report.companyGlobalTotal, null)
  assert.equal(report.companyIndiaTotal, null)
  assert.deepEqual(report.blockedIO, [])
})
