import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { gunzipSync } from 'node:zlib'
import { before, after, beforeEach, test } from 'node:test'
import { parseDetail } from '../../scraper/enphaseenergy.workday/native.js'
import { storedAvailabilityMarker, readNativeRoleAvailability } from '../utils/sourceAvailability.js'

process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false'
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/availability_disconnected_guard'
const { default: mongoose } = await import('mongoose')
const { MongoMemoryServer } = await import('mongodb-memory-server')
const { default: Job } = await import('../../src/models/Job.js')
const { saveToDB } = await import('../utils/saveToDB.js')
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/enphaseenergy.workday/fixtures/native-002.json.gz', import.meta.url))))
const row = fixture.receipts.filter(r => r.kind.startsWith('listing-page-')).flatMap(r => JSON.parse(r.storedBodyUTF8).rows).find(r => r.jid === 'o9tUAfwQ')
const html = fixture.receipts.find(r => r.kind === 'india-detail-' + row.jid).storedBodyUTF8
const closedHtml = html.replace('<div class="jobvite-detail__intro">', '<div class="jobvite-detail__intro"><p>This position is closed.</p>')
const source = 'enphaseenergy', t0 = '2026-10-25T08:00:00.000Z', t1 = '2026-10-25T09:00:00.000Z', t2 = '2026-10-25T10:00:00.000Z', t3 = '2026-10-25T11:00:00.000Z'
const open = clock => parseDetail(html, structuredClone(row), { now: clock })
const closed = clock => parseDetail(closedHtml, structuredClone(row), { now: clock })
const unknown = clock => {
  const job = open(clock); delete job.sourceAvailabilityEvidence
  return { ...job, sourceDescription: null, jobDescription: null, sourceDetailComplete: false, sourceDetailStatus: 'native-description-missing' }
}
const save = (jobs, clock) => saveToDB(jobs, source, { now: new Date(clock), enrichPublicExperience: false,
  descriptionRewriteMode: 'off', enqueueAlerts: false, refreshDatasetSummary: false })
const stored = () => Job.findOne({ source, jobId: row.jid }).lean()
const marker = job => storedAvailabilityMarker(readNativeRoleAvailability(job))
const originalFetch = globalThis.fetch
let mongo
const output = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-native-availability-'))
const proof = { output, source, actualCapturedOpenPacket: true, closedHeaderIsSynthetic: true, controlledClock: true,
  productionWrites: false, externalNetworkForbidden: true, cases: [] }
before(async () => {
  assert.equal(mongoose.connection.readyState, 0); proof.initialMongooseReadyState = 0
  globalThis.fetch = async () => { throw Error('External network forbidden in isolated availability verification') }
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1', dbName: 'codex_native_availability' },
    binary: { version: '8.2.6' } })
  const uri = mongo.getUri('codex_native_availability')
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/codex_native_availability/)
  process.env.MONGO_URI = uri; await mongoose.connect(uri, { autoIndex: false, autoCreate: false })
  assert.equal(mongoose.connection.host, '127.0.0.1')
  await Job.collection.createIndex({ fingerprint: 1 }, { unique: true })
})
beforeEach(async () => { await Job.deleteMany({}) })
after(async () => {
  await mongoose.disconnect(); await mongo?.stop(); globalThis.fetch = originalFetch
  proof.finalMongooseReadyState = mongoose.connection.readyState
  proof.passed = proof.cases.filter(c => c.passed).length; proof.failed = proof.cases.filter(c => !c.passed).length
  await fs.writeFile(path.join(output, 'verification.json'), JSON.stringify(proof, null, 2))
  console.log('NATIVE_AVAILABILITY_PROOF ' + JSON.stringify({ output, passed: proof.passed, failed: proof.failed,
    initialMongooseReadyState: proof.initialMongooseReadyState, finalMongooseReadyState: proof.finalMongooseReadyState }))
})
const check = (name, action) => test(name, async t => {
  const record = { name }; proof.cases.push(record)
  try { await action(record, t); record.passed = true } catch (error) { record.passed = false; record.error = { message: error.message }; throw error }
})
const stable = job => Object.fromEntries(['sourceDescription', 'postedAt', 'sortDate', 'postedAtProvenance', 'postedAtProvenanceValue',
  'closingDate', 'scrapedAt', 'scrapedTimestamp', 'lastSeenAt', 'updatedAt', 'missedScrapeCount'].map(k => [k, job[k]]))
const seed = async () => { await save([open(t0)], t0); return stored() }
const installClosed = async () => {
  const job = await seed()
  await Job.collection.updateOne({ _id: job._id }, { $set: { status: 'expired', sourceAvailability: marker(closed(t1)) } })
  return stored()
}

check('fresh verified native closure expires only its existing role and preserves all content/lifecycle clocks', async record => {
  const before = await seed(), raw = closed(t1), copy = structuredClone(raw)
  const result = await save([raw], t1), after = await stored()
  assert.equal(after.status, 'expired'); assert.equal(after.sourceAvailability.state, 'closed')
  assert.equal(after.sourceAvailability.observedAt.toISOString(), t1)
  assert.equal(Object.hasOwn(after.sourceAvailability, 'closedAt'), false)
  assert.deepEqual(stable(after), stable(before)); assert.deepEqual(raw, copy)
  assert.equal(result.inserted, 0); assert.equal(result.filteredClosed, 1)
  assert.equal(result.correctedNativeAvailability, 1); assert.equal(result.deleted, 0); assert.equal(result.missed, 0)
  record.result = result
})
check('a closed native row never inserts a new job', async () => {
  const result = await save([closed(t1)], t1)
  assert.equal(result.inserted, 0); assert.equal(result.filteredClosed, 1); assert.equal(await Job.countDocuments(), 0)
})
check('an availability-unknown row cannot reactivate a verified closed existing role', async () => {
  const before = await installClosed(); await save([unknown(t2)], t2)
  const after = await stored(); assert.equal(after.status, 'expired')
  assert.deepEqual(after.sourceAvailability, before.sourceAvailability)
  assert.equal(after.postedAt.toISOString(), before.postedAt.toISOString())
})
check('a new missing-JD identity retains current insertion policy without fabricating open proof', async () => {
  const job = { ...unknown(t0), jobId: 'synthetic-missing', requisitionId: '99999999',
    sourceUrl: 'https://enphase.com/job/synthetic-missing', applyUrl: 'https://enphase.com/job/synthetic-missing' }
  const result = await save([job], t0), inserted = await Job.findOne({ jobId: job.jobId }).lean()
  assert.equal(result.inserted, 1); assert.equal(inserted.status, 'active'); assert.equal(inserted.sourceAvailability, undefined)
})
check('a newer verified eligible open role reactivates a native closure without renewing publication age', async () => {
  const before = await installClosed(); await save([open(t2)], t2)
  const after = await stored(); assert.equal(after.status, 'active'); assert.equal(after.sourceAvailability.state, 'open')
  assert.equal(after.sourceAvailability.observedAt.toISOString(), t2)
  assert.equal(after.postedAt.toISOString(), before.postedAt.toISOString()); assert.equal(after.sortDate.toISOString(), before.sortDate.toISOString())
})
check('older open proof processed later cannot reactivate a newer verified closure', async () => {
  const before = await installClosed(); await save([open(t0)], t3)
  const after = await stored(); assert.equal(after.status, 'expired'); assert.deepEqual(after.sourceAvailability, before.sourceAvailability)
})
check('ordinary legacy expiration without a verified native marker keeps its previous reactivation behavior', async () => {
  const job = await seed(); await Job.collection.updateOne({ _id: job._id }, { $set: { status: 'expired' }, $unset: { sourceAvailability: '' } })
  await save([unknown(t2)], t2); assert.equal((await stored()).status, 'active')
})
for (const [name, observed, processing] of [['older-than48h', '2026-10-22T08:00:00.000Z', t1], ['future', t2, t1]]) {
  check(name + ' closed proof cannot expire an existing role', async () => {
    const before = await seed(), result = await save([closed(observed)], processing), after = await stored()
    assert.equal(after.status, 'active'); assert.deepEqual(stable(after), stable(before))
    assert.equal(result.correctedNativeAvailability || 0, 0)
  })
}
check('a native proof exactly48h old is still bounded fresh evidence', async () => {
  await seed(); await save([closed(t1)], '2026-10-27T09:00:00.000Z'); assert.equal((await stored()).status, 'expired')
})
check('same role ID under a different stored source or canonical URL cannot be expired', async () => {
  const job = await seed(); await Job.collection.updateOne({ _id: job._id }, { $set: { sourceUrl: 'https://enphase.com/job/another-role' } })
  await save([closed(t1)], t1); assert.equal((await Job.findById(job._id).lean()).status, 'active')
  await Job.collection.updateOne({ _id: job._id }, { $set: { source: 'other-source', sourceUrl: job.sourceUrl } })
  await save([closed(t1)], t1); assert.equal((await Job.findById(job._id).lean()).status, 'active')
})
check('a role-scoped closure neither updates a peer vacancy nor records company-wide lifecycle misses', async () => {
  await seed()
  const peer = { ...unknown(t0), jobId: 'synthetic-peer', requisitionId: '99999998',
    sourceUrl: 'https://enphase.com/job/synthetic-peer', applyUrl: 'https://enphase.com/job/synthetic-peer' }
  await save([peer], t0)
  const before = await Job.findOne({ jobId: peer.jobId }).lean()
  const result = await save([closed(t1)], t1), after = await Job.findById(before._id).lean()
  assert.deepEqual(after, before); assert.equal(result.correctedNativeAvailability, 1)
  assert.equal(result.missed, 0); assert.equal(result.deleted, 0)
})
check('a stored title/employer mismatch cannot be corrected using another native identity snapshot', async () => {
  const before = await seed()
  for (const fields of [{ originalTitle: 'A different role' }, { company: 'A different employer', originalTitle: before.originalTitle }]) {
    await Job.collection.updateOne({ _id: before._id }, { $set: fields })
    const result = await save([closed(t1)], t1), after = await Job.findById(before._id).lean()
    assert.equal(after.status, 'active'); assert.equal(result.correctedNativeAvailability || 0, 0)
  }
})
check('newer processing observation alone does not override an older native closure proof', async () => {
  await seed(); await save([unknown(t3)], t3)
  const before = await stored(); await save([closed(t2)], t3)
  const after = await stored(); assert.equal(after.status, 'expired'); assert.deepEqual(stable(after), stable(before))
  assert.equal(after.sourceAvailability.observedAt.toISOString(), t2)
})

async function race(t, predicate, mutate, action) {
  const original = Job.bulkWrite; let raced = false
  Job.bulkWrite = async function (operations, options) {
    if (!raced && operations.some(predicate)) { raced = true; await mutate() }
    return original.call(this, operations, options)
  }
  t.after(() => { Job.bulkWrite = original })
  await action(); assert.equal(raced, true, 'Expected the guarded lifecycle operation to run')
}
const closingWrite = op => op.updateOne?.update?.$set?.sourceAvailability?.state === 'closed'
const transitionWrite = op => Array.isArray(op.updateOne?.update) && op.updateOne.update.some(stage => stage.$set?.status)
check('closure CAS cannot overwrite a concurrent newer verified reopen', async (_record, t) => {
  const before = await seed()
  await race(t, closingWrite, () => Job.collection.updateOne({ _id: before._id }, { $set: { status: 'active', sourceAvailability: marker(open(t2)), lastSeenAt: new Date(t2) } }),
    () => save([closed(t1)], t2))
  const after = await stored(); assert.equal(after.status, 'active'); assert.equal(after.sourceAvailability.observedAt.toISOString(), t2)
})
check('closure CAS cannot alter a concurrently reassigned native identity', async (_record, t) => {
  const before = await seed()
  await race(t, closingWrite, () => Job.collection.updateOne({ _id: before._id }, { $set: { jobId: 'other-native-id', sourceUrl: 'https://enphase.com/job/other-native-id' } }),
    () => save([closed(t1)], t1))
  assert.equal((await Job.findById(before._id).lean()).status, 'active')
})
check('unknown writer atomically preserves a concurrent verified reopen rather than copying expired read status', async (_record, t) => {
  const before = await installClosed()
  await race(t, transitionWrite, () => Job.collection.updateOne({ _id: before._id }, { $set: { status: 'active', sourceAvailability: marker(open(t2)) } }),
    () => save([unknown(t3)], t3))
  const after = await stored(); assert.equal(after.status, 'active'); assert.equal(after.sourceAvailability.state, 'open')
})
check('open writer cannot supersede a newer closure committed after its lookup', async (_record, t) => {
  const before = await seed()
  await race(t, transitionWrite, () => Job.collection.updateOne({ _id: before._id }, { $set: { status: 'expired', sourceAvailability: marker(closed(t2)) } }),
    () => save([open(t1)], t3))
  const after = await stored(); assert.equal(after.status, 'expired'); assert.equal(after.sourceAvailability.observedAt.toISOString(), t2)
})
