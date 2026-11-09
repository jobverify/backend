import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import {
  verifyPartialPublishingTrial, planPartialPublishingRollout, executePartialPublishingRollout,
  recordPartialPublishingStatus, buildPartialAttempt,
} from '../scripts/partialPublishingGapEvidence.js'

const now = new Date('2026-10-21T00:00:00Z')
const at = '2026-10-20T23:00:00Z'
const hash = value => createHash('sha256').update(value).digest('hex')
const listingUrl = 'https://www.phonepe.com/apollo/job-postings/latest.json'
const careersUrl = 'https://www.phonepe.com/careers/job-openings/'
const publicUrl = 'https://jobs.smartrecruiters.com/PHONEPELIMITED/123-software-engineer'
const detailUrl = 'https://api.smartrecruiters.com/v1/companies/PHONEPELIMITED/postings/123'
const chunkName = 'component---src-pages-careers-job-openings-index-js'

function fixture() {
  const bodies = new Map()
  const receipts = []
  const add = (url, body) => {
    const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
    const file = `${receipts.length}.body`
    bodies.set(file, bytes)
    receipts.push({ url, finalUrl: url, status: 200, fetchedAt: at, file, bytes: bytes.length, sha256: hash(bytes) })
    return file
  }
  const appUrl = 'https://www.phonepe.com/webstatic/1/app-a.js'
  const runtimeUrl = 'https://www.phonepe.com/webstatic/1/webpack-runtime-b.js'
  const componentUrl = `https://www.phonepe.com/webstatic/1/${chunkName}-abc.js`
  add(careersUrl, `<script src="${appUrl}"></script><script src="${runtimeUrl}"></script>`)
  add(appUrl, `"${chunkName}":()=>Promise.all([n.e(4339)]).then(n.bind(n,94554))`)
  add(runtimeUrl, `4339:"${chunkName}",4339:"abc"`)
  add(componentUrl, `fetch("${listingUrl}");records.filter(e=>"PUBLIC"===e.status&&e.applyUrl)`)
  add(listingUrl, { totalCount: 2, fetchedAt: at, results: [
    { status: 'PUBLIC', title: 'Software Engineer', location: 'Bengaluru', applyUrl: publicUrl },
    { status: 'NOT_PUBLISHED', title: 'Private role', applyUrl: null },
  ] })
  add(detailUrl, { id: '123', company: { identifier: 'PHONEPELIMITED' },
    postingUrl: publicUrl, location: { country: 'in', city: 'Bengaluru' },
    jobAd: { sections: { jobDescription: { text: '<p>Build and maintain reliable production software.</p>' } } } })
  const trial = {
    schemaVersion: 1, source: 'phonepe', mode: 'native-http-partial-positive-trial',
    outcome: 'positive-extraction-incomplete-evidence', productionWrites: false,
    attemptedAt: at, completedAt: at,
    bindingEvidence: { source: 'phonepe', companyName: 'PhonePe', companyDomain: 'phonepe.com',
      careersUrl, listingUrl, expectedCompany: 'PHONEPELIMITED', verifiedAt: at,
      appUrl, runtimeUrl, componentUrl, componentChunkId: 4339 },
    httpEvidence: { mode: 'native-direct-live-http', receipts },
    publicListingProof: { rawTotal: 2, publicTotal: 1, pagesFetched: 1, fullResponse: true },
    inventoryEvidence: { status: 'discovery-only', listingComplete: false, firstParty: true,
      surface: listingUrl, reportedTotal: 2, indiaFacetCount: 1, pagesFetched: 1, verifiedAt: at,
      reason: 'detail-incomplete' },
    jobs: [{ source: 'phonepe', company: 'PhonePe', title: 'Software Engineer', location: 'Bengaluru',
      country: 'India', jobId: publicUrl, sourceUrl: publicUrl, applyUrl: publicUrl, link: publicUrl,
      jobDescription: '<p>Build and maintain reliable production software.</p>', sourceListingComplete: false }],
  }
  return { trial, readEvidence: file => bodies.get(file), now,
    bytes: Buffer.from(JSON.stringify(trial)), bodies }
}
const serialize = f => ({ ...f, bytes: Buffer.from(JSON.stringify(f.trial)) })
const withMissingPublicRole = (f, location = { country: 'in', city: 'Bengaluru' }) => {
  const receipt = f.trial.httpEvidence.receipts.find(r => r.url === listingUrl)
  const payload = JSON.parse(f.bodies.get(receipt.file))
  const missingUrl = publicUrl.replace('/123-', '/124-')
  payload.results.push({ status: 'PUBLIC', title: 'Software Engineer II', location: 'Bengaluru', applyUrl: missingUrl })
  payload.totalCount++
  const listingBytes = Buffer.from(JSON.stringify(payload))
  f.bodies.set(receipt.file, listingBytes); receipt.bytes = listingBytes.length; receipt.sha256 = hash(listingBytes)
  const body = Buffer.from(JSON.stringify({ id: '124', company: { identifier: 'PHONEPELIMITED' },
    postingUrl: missingUrl, location, jobAd: { sections: { jobDescription: { text: '' } } } }))
  const file = 'missing-role.body'
  f.bodies.set(file, body)
  f.trial.httpEvidence.receipts.push({ url: detailUrl.replace('/123', '/124'), status: 200,
    fetchedAt: at, file, bytes: body.length, sha256: hash(body) })
  f.trial.publicListingProof.rawTotal++
  f.trial.publicListingProof.publicTotal++
  f.trial.inventoryEvidence.reportedTotal++
  f.trial.inventoryEvidence.indiaFacetCount++
  return serialize(f)
}
const validationFor = f => ({ environment: 'temporary-local-mongodb', productionWrites: false,
  generatedAt: at, passedSources: 1, siteSettings: { experiencedJobsEnabled: true },
  rows: [{ source: 'phonepe', trialByteHash: hash(f.bytes), outcome: 'passed', visibleJobs: 1,
    eligibleJobs: 1, idempotent: true, priorJobsPreserved: true, partialStatusPreserved: true }] })

test('partial gate verifies native exact-byte listing, official binding and eligible role content', async () => {
  const f = fixture()
  const result = await verifyPartialPublishingTrial(f)
  assert.equal(result.eligibleJobs, 1)
  assert.equal(result.rawTotal, 2)
  assert.equal(result.publicTotal, 1)
  assert.equal(result.trial.inventoryEvidence.listingComplete, false)
})

test('partial gate rejects stale, invented, truncated, altered or mismatched evidence', async () => {
  for (const mutate of [
    f => { f.trial.completedAt = '2026-01-01T00:00:00Z' },
    f => { f.trial.httpEvidence.mode = 'fixture-replay' },
    f => { f.trial.httpEvidence.receipts[0].status = 403 },
    f => { f.bodies.set('0.body', Buffer.from('tampered')) },
    f => { f.trial.bindingEvidence.expectedCompany = 'OTHER' },
    f => { f.trial.publicListingProof.rawTotal = 10 },
    f => { f.trial.publicListingProof.publicTotal = 9 },
    f => { f.trial.publicListingProof.fullResponse = false },
    f => { f.trial.jobs[0].jobDescription = 'Invented description' },
    f => { f.trial.jobs[0].location = 'Delhi' },
    f => { f.trial.jobs[0].jobId = 'another-role' },
    f => { f.trial.jobs[0].applyUrl = 'https://jobs.smartrecruiters.com/OTHER/123-role' },
    f => { f.trial.jobs[0].sourceListingComplete = true },
    f => { f.trial.inventoryEvidence.listingComplete = true },
    f => { f.trial.jobs = [] },
    f => { f.trial.maxJobs = 1 },
  ]) {
    const f = fixture(); mutate(f)
    await assert.rejects(verifyPartialPublishingTrial(serialize(f)))
  }
})

test('partial planner requires exact file bytes validated in temporary Mongo', async () => {
  const f = fixture()
  const validation = validationFor(f)
  const plan = await planPartialPublishingRollout({ entries: [f], validation, now })
  assert.deepEqual(plan.batches, [['phonepe']])
  await assert.rejects(planPartialPublishingRollout({ entries: [{ ...f, bytes: Buffer.from(JSON.stringify(f.trial, null, 2)) }], validation, now }), /byte|hash/i)
  for (const changes of [
    { environment: 'production' }, { productionWrites: true }, { passedSources: 0 },
    { rows: [{ ...validation.rows[0], priorJobsPreserved: false }] },
    { rows: [{ ...validation.rows[0], partialStatusPreserved: false }] },
  ]) await assert.rejects(planPartialPublishingRollout({ entries: [f], validation: { ...validation, ...changes }, now }))
})

test('listing location must agree with the matched native detail, not merely claim India', async () => {
  const f = fixture()
  const receipt = f.trial.httpEvidence.receipts.find(r => r.url === detailUrl)
  const payload = JSON.parse(f.bodies.get(receipt.file))
  payload.location.city = 'Mumbai'
  const body = Buffer.from(JSON.stringify(payload))
  f.bodies.set(receipt.file, body); receipt.sha256 = hash(body); receipt.bytes = body.length
  await assert.rejects(verifyPartialPublishingTrial(serialize(f)), /location/i)
})

test('missing-content native roles must still prove India scope and matching nonblank locations', async () => {
  for (const location of [
    { country: 'us', city: 'Bengaluru' }, { country: 'in', city: 'Mumbai' },
    { city: 'Bengaluru' }, { country: 'in', city: ' ' }, null,
  ]) await assert.rejects(verifyPartialPublishingTrial(withMissingPublicRole(fixture(), location)), /country|location|India/i)
})

test('partial attempt diagnostics inspect every public native role and preserve unknown rejection metrics', async () => {
  const proof = await verifyPartialPublishingTrial(withMissingPublicRole(fixture()))
  assert.equal(proof.publicTotal, 2)
  assert.equal(proof.eligibleJobs, 1)
  const attempt = buildPartialAttempt(proof, { inserted: 1, updated: 0, deleted: 0, expired: 0, missed: 0 }, now)
  assert.equal(attempt.jobs, 2)
  assert.equal(attempt.filteredEmptyDescription, 1)
  assert.equal(attempt.filteredNonIndia, 0)
  assert.equal(attempt.filteredInvalidUrl, 0)
  assert.equal(attempt.filteredClosed, null)
  assert.equal(attempt.filteredNonJob, null)
  assert.deepEqual(attempt.detailHealth, { complete: false, inspectedJobs: 2,
    incompleteJobs: 1, missingDescriptions: 1, failureKinds: { 'missing-content': 1 } })
  assert.equal(attempt.success, false)
  assert.equal(attempt.inventoryEvidence.listingComplete, false)
})

test('partial status writes preserve complete-check fields and require an active existing source', async () => {
  const f = fixture()
  const proof = await verifyPartialPublishingTrial(f)
  let update
  const database = { collection: name => {
    assert.equal(name, 'scraperstatuses')
    return { updateOne: async (filter, payload) => {
      assert.deepEqual(filter, { source: 'phonepe', isActive: true })
      update = payload
      return { matchedCount: 1 }
    } }
  } }
  await recordPartialPublishingStatus(database, 'phonepe', buildPartialAttempt(proof,
    { inserted: 1, updated: 0, deleted: 0, expired: 0, missed: 0 }, now))
  assert.equal(update.$set.lastSuccess, false)
  assert.equal(update.$set.latestAttempt.success, false)
  for (const key of ['lastCompleteCheckAt', 'lastCompleteJobsFound', 'lastCompleteEligibleJobsFound',
    'lastJobsFound', 'lastEligibleJobsFound', 'isActive']) assert.equal(Object.hasOwn(update.$set, key), false)
})

const snapshot = () => ({ databaseAvailable: true, statuses: [{ source: 'phonepe', isActive: true }],
  siteSettings: { experiencedJobsEnabled: true }, inventory: [{ source: 'phonepe', visibleJobs: 1 }],
  publicCompanyNames: ['PhonePe'] })

test('partial executor upserts without cleanup or alerts and never reports successful complete health', async () => {
  const f = fixture(); const calls = []; const recorded = []
  const result = await executePartialPublishingRollout({ entries: [f], validation: validationFor(f), now,
    collectSnapshot: async () => snapshot(),
    saveJobs: async (...args) => { calls.push(args); return { inserted: 1, updated: 0, deleted: 0, expired: 0, missed: 0 } },
    recordPartialStatus: async (source, status) => recorded.push({ source, status }),
    verifyVisibility: async () => 1,
    checkpoint: async () => {},
  })
  assert.equal(result.completed, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][2].replaceExisting, false)
  assert.equal(calls[0][2].enqueueAlerts, false)
  assert.equal(calls[0][2].descriptionRewriteMode, 'off')
  assert.equal(recorded[0].status.success, false)
  assert.equal(recorded[0].status.staleCheckSkipped, true)
  assert.equal(recorded[0].status.inventoryEvidence.listingComplete, false)
  assert.equal(recorded[0].status.lastCompleteCheckAt, undefined)
})

test('disabled sources, unavailable snapshots and absent target visibility cannot be published as success', async () => {
  for (const mode of ['disabled', 'unknown-admin', 'unavailable', 'no-visibility']) {
    const f = fixture(); let writes = 0; const checkpoints = []
    const result = await executePartialPublishingRollout({ entries: [f], validation: validationFor(f), now,
      collectSnapshot: async () => {
        const value = snapshot()
        if (mode === 'disabled') value.statuses[0].isActive = false
        if (mode === 'unknown-admin') value.statuses = []
        if (mode === 'unavailable') value.databaseAvailable = false
        return value
      },
      saveJobs: async () => { writes++; return { inserted: 1, updated: 0, deleted: 0, expired: 0, missed: 0 } },
      recordPartialStatus: async () => {}, verifyVisibility: async () => 0,
      checkpoint: async p => checkpoints.push(structuredClone(p)),
    })
    assert.equal(result.completed, false)
    assert.equal(result.afterCompanies, null)
    if (mode !== 'no-visibility') assert.equal(writes, 0)
    assert.ok(checkpoints.length)
  }
})

test('a thrown upsert records an uncertain write attempt instead of implying zero writes', async () => {
  const f = fixture()
  const result = await executePartialPublishingRollout({ entries: [f], validation: validationFor(f), now,
    collectSnapshot: async () => snapshot(), saveJobs: async () => { throw new Error('Connection interrupted') },
    recordPartialStatus: async () => assert.fail('No successful write result exists'),
    verifyVisibility: async () => assert.fail('Failed write cannot be verified as success'),
    checkpoint: async () => {},
  })
  assert.equal(result.completed, false)
  assert.equal(result.afterCompanies, null)
  assert.deepEqual(result.writeAttempts, [{ source: 'phonepe', phase: 'started', inserted: null, updated: null }])
})
