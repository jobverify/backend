import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { gunzipSync } from 'node:zlib'
import { before, after, beforeEach, test } from 'node:test'
import { inspectSearch, parsePage, parseDetail } from '../../scraper/disney.workday/nativeContract.js'
import { readNativeRoleAvailability, storedAvailabilityMarker } from '../utils/sourceAvailability.js'

process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false'
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/availability_disney_disconnected_guard'
const { default: mongoose } = await import('mongoose')
const { MongoMemoryServer } = await import('mongodb-memory-server')
const { default: Job } = await import('../../src/models/Job.js')
const { saveToDB } = await import('../utils/saveToDB.js')
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/disney.workday/fixtures/current-radancy-41.json.gz', import.meta.url))))
const source = 'disney', t0 = '2026-10-25T08:00:00.000Z', t1 = '2026-10-25T09:00:00.000Z', t2 = '2026-10-25T10:00:00.000Z', t3 = '2026-10-25T11:00:00.000Z'
const scope = inspectSearch(fixture.records[0].body)
const row = parsePage(fixture.records[1].body, { scope, page: 1, now: t0 }).rows[0]
const html = fixture.records.find(packet => packet.url === row.url).body
const closeHtml = body => {
  const start = body.indexOf('id="job-details-1"'), end = body.indexOf('>', start)
  assert.ok(start >= 0 && end > start)
  return body.slice(0, end + 1) + '<p>This position is closed.</p>' + body.slice(end + 1)
}
const open = clock => parseDetail(html, structuredClone(row), clock)
const closed = clock => parseDetail(closeHtml(html), structuredClone(row), clock)
const migrated = clock => {
  const id = '999999999991', body = html.replaceAll(row.id, id)
  return parseDetail(body, { ...row, id, url: row.url.replace(row.id, id) }, clock)
}
const marker = job => storedAvailabilityMarker(readNativeRoleAvailability(job))
const save = (jobs, clock) => saveToDB(jobs, source, { now: new Date(clock), enrichPublicExperience: false,
  descriptionRewriteMode: 'off', enqueueAlerts: false, refreshDatasetSummary: false })
const stored = () => Job.findOne({ source }).lean()
const stableDates = job => Object.fromEntries(['postedAt', 'sortDate', 'postedAtProvenance', 'postedAtProvenanceValue', 'closingDate'].map(k => [k, job[k]]))
const originalFetch = globalThis.fetch
let mongo
const output = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-disney-availability-binding-'))
const proof = { output, productionWrites: false, actualCapturedDisneyPacket: true, unchangedFixture: true,
  syntheticCanonicalMigrationAndClosure: true, controlledClocks: true, externalNetworkForbidden: true, cases: [] }
before(async () => {
  assert.equal(mongoose.connection.readyState, 0); proof.initialMongooseReadyState = 0
  globalThis.fetch = async () => { throw Error('External network forbidden in isolated Disney availability verification') }
  mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1', dbName: 'codex_disney_availability_binding' },
    binary: { version: '8.2.6' } })
  const uri = mongo.getUri('codex_disney_availability_binding')
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:\d+\/codex_disney_availability_binding/)
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
  console.log('DISNEY_AVAILABILITY_BINDING_PROOF ' + JSON.stringify({ output, passed: proof.passed, failed: proof.failed,
    initialMongooseReadyState: proof.initialMongooseReadyState, finalMongooseReadyState: proof.finalMongooseReadyState }))
})
const check = (name, action) => test(name, async t => {
  const record = { name }; proof.cases.push(record)
  try { await action(record, t); record.passed = true } catch (error) { record.passed = false; record.error = error.message; throw error }
})
const seedClosed = async clock => {
  await save([open(t0)], t0); await save([closed(clock)], clock)
  const job = await stored(); assert.equal(job.status, 'expired'); return job
}

check('a newer fully verified Disney canonical migration reopens the same requisition without renewing publication', async record => {
  const before = await seedClosed(t1), job = migrated(t2)
  assert.equal(job.jobId, before.jobId); assert.equal(job.applyUrl, before.applyUrl)
  assert.notEqual(job.sourceUrl, before.sourceUrl)
  await save([job], t2); const after = await stored()
  assert.equal(await Job.countDocuments(), 1); assert.equal(after.status, 'active')
  assert.equal(after.sourceAvailability.state, 'open'); assert.equal(after.sourceAvailability.canonicalUrl, job.sourceUrl)
  assert.equal(after.sourceAvailability.observedAt.toISOString(), t2); assert.deepEqual(stableDates(after), stableDates(before))
  record.canonicalChanged = true
})
check('older verified open proof under another canonical URL cannot undo a newer closure of the same requisition', async () => {
  const before = await seedClosed(t2); await save([migrated(t1)], t3)
  const after = await stored(); assert.equal(after.status, 'expired'); assert.deepEqual(after.sourceAvailability, before.sourceAvailability)
})
check('a mismatching canonical marker cannot permanently hold a newer verified current Disney role closed', async () => {
  await save([open(t0)], t0); const before = await stored(), alien = marker(closed(t1))
  alien.canonicalUrl = row.url.replace(row.id, '999999999993'); alien.canonicalRoleId = '999999999993'
  await Job.collection.updateOne({ _id: before._id }, { $set: { status: 'expired', sourceAvailability: alien } })
  await save([open(t2)], t2); const after = await stored()
  assert.equal(after.status, 'active'); assert.equal(after.sourceAvailability.canonicalUrl, row.url)
})
check('a marker for an unrelated requisition is not authoritative availability for the current native role', async () => {
  await save([open(t0)], t0); const before = await stored(), alien = marker(closed(t2)); alien.jobId = '99999999'
  await Job.collection.updateOne({ _id: before._id }, { $set: { status: 'expired', sourceAvailability: alien } })
  await save([open(t1)], t3); const after = await stored()
  assert.equal(after.status, 'active'); assert.equal(after.sourceAvailability.jobId, row.req)
})
check('a canonical change with unknown detail cannot reopen an established native closure', async () => {
  const before = await seedClosed(t1), job = migrated(t2)
  delete job.sourceAvailabilityEvidence
  Object.assign(job, { sourceDescription: null, jobDescription: null, sourceDetailComplete: false })
  await save([job], t2); const after = await stored()
  assert.equal(after.status, 'expired'); assert.deepEqual(after.sourceAvailability, before.sourceAvailability)
})
check('a separately coherent old requisition closure snapshot cannot expire a current new requisition', async () => {
  const req = '99999999', newHtml = html.replaceAll(row.req, req)
  const job = parseDetail(newHtml, { ...row, req }, t0)
  await save([job], t0); const before = await stored()
  const forged = { ...job, sourceDescription: null, jobDescription: null, sourceDetailComplete: false,
    sourceAvailabilityEvidence: { ...closed(t1).sourceAvailabilityEvidence, jobId: req } }
  assert.equal(readNativeRoleAvailability(forged).validated, false)
  const result = await save([forged], t1), after = await stored()
  assert.equal(after.status, 'active'); assert.deepEqual(stableDates(after), stableDates(before))
  assert.equal(result.correctedNativeAvailability || 0, 0); assert.equal(result.filteredClosed, 0)
})
check('a concurrent newer closure still wins against an older canonical-migration open writer', async (_record, t) => {
  await save([open(t0)], t0); const before = await stored(), original = Job.bulkWrite; let raced = false
  Job.bulkWrite = async function (operations, options) {
    if (!raced && operations.some(op => Array.isArray(op.updateOne?.update) && op.updateOne.update.some(stage => stage.$set?.status))) {
      raced = true
      await Job.collection.updateOne({ _id: before._id }, { $set: { status: 'expired', sourceAvailability: marker(closed(t2)) } })
    }
    return original.call(this, operations, options)
  }
  t.after(() => { Job.bulkWrite = original })
  await save([migrated(t1)], t3); assert.equal(raced, true)
  const after = await stored(); assert.equal(after.status, 'expired'); assert.equal(after.sourceAvailability.observedAt.toISOString(), t2)
})
