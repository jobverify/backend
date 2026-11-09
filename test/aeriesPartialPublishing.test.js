import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { AERIES_PARTIAL_CONTRACTS, deriveAeriesPartialEvidence as deriveCurrentAeriesPartialEvidence } from '../scripts/aeriesPartialPublishingEvidence.js'
import { isSuccessfulPublishingGapTrial } from '../scripts/publishPublishingGapRepairs.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { createReviewedProofRuntime } from './helpers/reviewedProofRuntime.js'

const now = new Date('2026-10-21T03:00:00Z'), hash = bytes => createHash('sha256').update(bytes).digest('hex')
const raw = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/aeriesPartial/native-reviewed-002.json.gz', import.meta.url))))
const baseFiles = new Map(Object.entries(raw.files).map(([file, body]) => [file, Buffer.from(body, 'base64')]))
const fixture = () => { const files = new Map(baseFiles); return { source: raw.source, files, httpEvidence: structuredClone(raw.httpEvidence), readEvidence: async file => files.get(file), now } }
// The October 21 proof predates both the one-month age limit and the policy
// retaining jobs with missing descriptions. Keep its original success cases
// tied to the actual policy implementation from that historical Git revision.
const reviewedMetrics = gunzipSync(fs.readFileSync(new URL('./fixtures/aeriesPartial/reviewed-publishableJobMetrics-7ebb487d0.js.gz', import.meta.url)))
assert.equal(hash(reviewedMetrics), 'f7d4baf7d52d6f3efd0fe23e5adbfff820f53194f3a3ddfbe7a0982d385b0621')
const providerUrl = new URL('../scraper-support/providers/index.js', import.meta.url).href
const relocatedCatalog = Buffer.from(`
import { fileURLToPath } from 'node:url';
import { getScraperCatalog as liveCatalog } from ${JSON.stringify(providerUrl)};
export * from ${JSON.stringify(providerUrl)};
export const getScraperCatalog = (...args) => liveCatalog(...args).map(provider =>
  provider.source === 'aeriestechnology'
    ? { ...provider, modulePath: fileURLToPath(new URL('../../scraper/aeriestechnology/script.js', import.meta.url)) }
    : provider);
`)
const reviewedRuntime = createReviewedProofRuntime(fixture(), { prefix: 'aeries-reviewed-code-', extraFiles: new Map([
  ['scraper-support/utils/publishableJobMetrics.js', reviewedMetrics],
  ['scraper-support/providers/index.js', relocatedCatalog],
]) })
after(() => reviewedRuntime.cleanup())
const { deriveAeriesPartialEvidence, verifyAeriesPartialPublishingTrial } = await import(reviewedRuntime.url('scripts/aeriesPartialPublishingEvidence.js'))
const { freezeAeriesPartialTrial } = await import(reviewedRuntime.url('scripts/freezeAeriesPartialTrial.js'))
const trialFor = async f => {
  const proof = await deriveAeriesPartialEvidence(f)
  const trial = { schemaVersion: 1, source: f.source, mode: 'native-http-partial-positive-trial', outcome: 'positive-extraction-incomplete-evidence', productionWrites: false,
    attemptedAt: proof.startedAt, completedAt: proof.capturedAt, httpEvidence: f.httpEvidence, rawJobs: 24, indiaJobs: 24, globalTotal: 24, observedSelectedIndia: 22,
    inventoryEvidence: proof.inventoryEvidence, bindingEvidence: proof.bindingEvidence, detailHealth: proof.detailHealth, selectedDetailHealth: proof.selectedDetailHealth,
    filterCounts: proof.filterCounts, originalCapture: proof.originalCapture, jobs: proof.jobs }
  return { trial, bytes: Buffer.from(JSON.stringify(trial)), readEvidence: f.readEvidence, now }
}
test('exact reviewed Aeries31 packets preserve original24 rows and two real placeholders while selecting all22 native full jobs', async () => {
  const f = fixture()
  const original = JSON.parse(f.files.get('evidence/frozen-trial.json'))
  const generalEligibility = analyzePublishableJobs(original.jobs, { now })
  assert.equal(generalEligibility.eligibleJobs.length, 6, 'current eligibility excludes the 18 archived roles older than one calendar month')
  assert.equal(generalEligibility.filterCounts.old, 18)
  assert.equal(generalEligibility.filterCounts.emptyDescription, 0)
  const args = await trialFor(f), result = await verifyAeriesPartialPublishingTrial(args)
  assert.deepEqual(Object.keys(AERIES_PARTIAL_CONTRACTS), ['aeriestechnology'])
  assert.equal(result.eligibleJobs, 22)
  assert.equal(result.rawTotal, 24)
  assert.equal(result.indiaTotal, 24)
  assert.equal(result.replayEvidence.requestsUsed, 31)
  assert.equal(result.inventoryEvidence.listingComplete, false)
  assert.equal(result.detailHealth.complete, false)
  assert.equal(result.detailHealth.missingDescriptions, 2)
  assert.equal(result.selectedDetailHealth.complete, true)
  assert.equal(args.trial.attemptedAt, original.attemptedAt)
  assert.equal(args.trial.completedAt, original.completedAt)
  for (const job of result.jobs) { assert.deepEqual(job, original.jobs.find(old => old.jobId === job.jobId)); assert.equal(job.sourceListingComplete, false); assert.equal(job.sourceDetailComplete, true) }
  assert.equal(isSuccessfulPublishingGapTrial(args.trial, { source: f.source, now }), false)
})

test('current publication policy rejects the historical Aeries proof without renewing its original job dates', async () => {
  await assert.rejects(deriveCurrentAeriesPartialEvidence(fixture()), /all and only22 original full native descriptions may qualify/)
})
test('native selected identity, descriptions, dates, partial diagnostics and original clocks cannot be changed or truncated', async () => {
  const args = await trialFor(fixture())
  for (const change of [
    t => t.jobs.pop(), t => { t.jobs[0].jobDescription = 'Invented text' }, t => { t.jobs[0].sourceDescription = 'Invented text' },
    t => { t.jobs[0].jobId = '9999' }, t => { t.jobs[0].nativeClientId = 999 }, t => { t.jobs[0].city = 'Paris' },
    t => { t.jobs[0].country = 'US' }, t => { t.jobs[0].applyUrl = 'https://unrelated.example/jobs/1' },
    t => { t.jobs[0].sourceListingComplete = true }, t => { t.jobs[0].closingDate = null }, t => { t.completedAt = now.toISOString() },
    t => { t.detailHealth.complete = true }, t => { t.filterCounts.emptyDescription = 0 }, t => { t.rawJobs = 22 },
    t => { t.inventoryEvidence.listingComplete = true }, t => { t.maxJobs = 22 }, t => { t.truncated = true },
  ]) { const trial = structuredClone(args.trial); change(trial); await assert.rejects(verifyAeriesPartialPublishingTrial({ ...args, trial, bytes: Buffer.from(JSON.stringify(trial)) })) }
})
test('stale, missing, duplicate and byte-tampered evidence cannot qualify with refreshed caller hashes', async () => {
  for (const change of [
    f => { f.now = new Date(+now + 72 * 3600000) }, f => { f.httpEvidence.receipts.pop() },
    f => f.httpEvidence.receipts.push({ ...f.httpEvidence.receipts[0] }), f => { f.files.set('evidence/frozen-trial.json', Buffer.from('{}')) },
    f => { f.files.set('evidence/independent-review.json', Buffer.from('{}')) }, f => { f.httpEvidence.receipts[0].file = 'evidence/../outside.json' },
    f => { const receipt = f.httpEvidence.receipts.find(r => r.kind === 'native'), packet = JSON.parse(f.files.get(receipt.file)); packet.status = 500;
      const bytes = Buffer.from(JSON.stringify(packet)); f.files.set(receipt.file, bytes); Object.assign(receipt, { bytes: bytes.length, sha256: hash(bytes) }) },
    f => { const receipt = f.httpEvidence.receipts.find(r => r.kind === 'source-code'); const bytes = Buffer.from('// changed code'); f.files.set(receipt.file, bytes); Object.assign(receipt, { bytes: bytes.length, sha256: hash(bytes) }) },
  ]) { const f = fixture(); change(f); await assert.rejects(deriveAeriesPartialEvidence(f)) }
})
test('unrelated source, false complete/zero status and production markers cannot use this positive-only exception', async () => {
  const args = await trialFor(fixture())
  for (const change of [t => { t.source = 'aeries' }, t => { t.outcome = 'extracted' }, t => { t.success = true }, t => { t.extractionComplete = true },
    t => { t.productionWrites = true }, t => { t.globalTotal = 0 }, t => { t.observedSelectedIndia = 21 }]) {
    const trial = structuredClone(args.trial); change(trial); await assert.rejects(verifyAeriesPartialPublishingTrial({ ...args, trial, bytes: Buffer.from(JSON.stringify(trial)) }))
  }
})
test('offline freezer preserves every original evidence byte and refuses reuse or an altered native manifest', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeries-partial-'))
  t.after(() => { assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('aeries-partial-')); fs.rmSync(dir, { recursive: true, force: true }) })
  const archive = path.join(dir, 'archive'); fs.mkdirSync(archive)
  const destinations = { 'release-manifest': 'release-manifest-001.json', 'code-attestation': 'aeries-reviewed-code-attestation-006.json', 'independent-review': 'aeries-independent-review-010.json',
    'capture-manifest': 'aeries-full-native-002/manifest.json', 'capture-trial': 'aeries-full-native-002/trial.json', 'frozen-trial': 'frozen-trials/aeriestechnology.json',
    'provider-identity': 'aeries-provider-current-009.json' }
  for (const receipt of raw.httpEvidence.receipts) {
    const relative = receipt.kind === 'native' ? 'aeries-full-native-002/' + receipt.originFile
      : receipt.kind === 'source-code' ? 'aeries-independent-review-007/code/' + receipt.sourcePath : destinations[receipt.kind]
    assert.ok(relative); const target = path.join(archive, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, baseFiles.get(receipt.file))
  }
  const options = { archiveDirectory: archive, outputDirectory: path.join(dir, 'frozen'), now }
  const frozen = await freezeAeriesPartialTrial(options), bytes = fs.readFileSync(frozen.file), trial = JSON.parse(bytes)
  const readEvidence = async relative => fs.readFileSync(path.join(options.outputDirectory, relative))
  assert.equal((await verifyAeriesPartialPublishingTrial({ trial, bytes, readEvidence, now })).eligibleJobs, 22)
  for (const receipt of raw.httpEvidence.receipts) assert.deepEqual(await readEvidence(receipt.file), baseFiles.get(receipt.file))
  await assert.rejects(freezeAeriesPartialTrial(options), /exist/i)
  fs.writeFileSync(path.join(archive, 'aeries-full-native-002/manifest.json'), '{}')
  await assert.rejects(freezeAeriesPartialTrial({ ...options, outputDirectory: path.join(dir, 'altered') }), /hash|reviewed/i)
  assert.equal(fs.existsSync(path.join(dir, 'altered')), false)
})
