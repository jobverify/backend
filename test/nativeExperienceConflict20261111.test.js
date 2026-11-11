import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import { runCurrentSoftProdigyKeka } from '../scraper/softprodigysystemsolutions/nativeKeka.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'
import { saveDryRunSnapshot } from '../scraper-support/utils/saveToDB.js'
import { extractJobFilterSignals } from '../src/utils/jobFilterSignals.js'
import { buildClassificationInput, resolveClassification } from '../src/services/jobClassificationPolicy.js'
import { alreadyClassified, sourceSnapshotFilter, resolvePostScrapeClassification } from '../src/services/postScrapeClassification.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/softprodigysystemsolutions/test-data/current-native-20261111.json.gz', import.meta.url))))
const BOARD = 'https://softprodigy.keka.com/careers/'
const acquire = async ({ matching = false } = {}) => {
  const rows = structuredClone(fixture.rows)
  if (matching) rows[0].experience = '6-8'
  const records = new Map([
    ['https://softprodigy.com/', [fixture.homepage, 'text/html']],
    [BOARD, [fixture.portal, 'text/html']],
    ['https://cdn.keka.com/careers/v/2026/scripts/app/app.min.js', [fixture.client, 'application/javascript']],
    [BOARD + 'api/organization/default/careerportalinfo', [JSON.stringify(fixture.account), 'application/json']],
    [BOARD + 'api/jobs/default/active', [JSON.stringify(rows), 'application/json']],
    [BOARD + 'jobdetails/135020', [matching ? fixture.detail.replaceAll('>6-7<', '>6-8<') : fixture.detail, 'text/html']],
  ])
  return (await runCurrentSoftProdigyKeka({ now: () => '2026-11-11T03:30:00.000Z',
    fetchImpl: async url => {
      const record = records.get(url)
      assert.ok(record, 'only current captured native requests are allowed: ' + url)
      const response = new Response(record[0], { status: 200, headers: { 'content-type': record[1] } })
      Object.defineProperty(response, 'url', { value: url })
      return response
    } }))[0]
}

const unresolved = job => {
  assert.equal(job.experienceRequired, null)
  assert.equal(job.experienceProfile.minimumYears, null)
  assert.equal(job.experienceProfile.maximumYears, null)
  assert.equal(job.experienceProfile.confidence, 'low')
  assert.deepEqual(job.experienceYears, [])
  assert.match(job.sourceDescription, /6-8 years in digital marketing/)
  assert.match(job.sourceDescription, /Experience listed in job summary: 6-7/)
}

test('the actual conflicting native criteria remain unresolved through repeated normalization and dry processing', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'native-experience-conflict-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const job = await acquire()
  unresolved(normalizeScrapedJob(normalizeScrapedJob(job)))
  const output = join(directory, 'jobs.json')
  await saveDryRunSnapshot([job], output, { fetchText: async () => { throw Error('conflicting original criteria must not be replaced by enrichment') }, useBrowserFallback: false })
  unresolved(JSON.parse(await readFile(output, 'utf8'))[0])
})

test('an explicit native conflict cannot be restored by authoritative classification', async () => {
  const job = await acquire()
  const classification = resolveClassification(job, null, { mode: 'policy', now: new Date('2026-11-11T03:30:00.000Z') })
  assert.equal(classification.resolved.experienceProfile.minimumYears, null)
  assert.equal(classification.resolved.experienceProfile.maximumYears, null)
  assert.deepEqual(classification.resolved.experienceYears, [])
  unresolved(normalizeScrapedJob({ ...job, classification }))
  const stale = resolveClassification({ ...job, sourceNativeExperienceConflict: undefined }, null,
    { mode: 'policy', now: new Date('2026-11-11T03:30:00.000Z') })
  assert.equal(stale.resolved.experienceProfile.minimumYears, 6)
  assert.equal(extractJobFilterSignals({ ...job, classification: stale }).experienceProfile.minimumYears, null)
  assert.equal(normalizeScrapedJob({ ...job, classification: stale }).classification.resolved.experienceProfile.minimumYears, null)
  unresolved(normalizeScrapedJob({ ...job, classification: stale }))
  const recomputed = resolvePostScrapeClassification(job, { modelLabel: 'Full-time Experienced', windows: 1,
    fullDescriptionCovered: true, scores: { 'Full-time Experienced': .97, 'Full-time Fresher': .01, Intern: .01, Contract: .01 } },
  { mode: 'policy', now: new Date('2026-11-11T03:30:00.000Z') })
  assert.equal(recomputed.resolved.experienceProfile.minimumYears, null)
  assert.equal(recomputed.resolved.experienceProfile.maximumYears, null)
  assert.deepEqual(recomputed.resolved.experienceYears, [])
  unresolved(normalizeScrapedJob({ ...job, classification: recomputed }))
})

test('conflict evidence changes cache identity and participates in classification compare-and-set', async () => {
  const job = await acquire(), options = { now: new Date('2026-11-11T03:30:00.000Z') }
  const original = buildClassificationInput({ ...job, sourceNativeExperienceConflict: undefined }, options)
  const explicitNull = buildClassificationInput({ ...job, sourceNativeExperienceConflict: null }, options)
  const conflicted = buildClassificationInput(job, options)
  assert.equal(original.inputHash, explicitNull.inputHash, 'absence and null keep existing cache semantics')
  assert.notEqual(original.inputHash, conflicted.inputHash)
  assert.deepEqual(conflicted.sourceNativeExperienceConflict, {
    kind: 'native-sidebar-and-own-role-description', sidebar: '6-7', ownRoleRequirement: '6 - 8 years',
  })
  assert.equal(alreadyClassified({ postClassification: { inputHash: original.inputHash, mode: 'policy', status: 'completed' } }, conflicted, 'policy'), false)
  const guards = sourceSnapshotFilter(job).$and.filter(condition => Object.keys(condition)[0].startsWith('sourceNativeExperienceConflict.'))
  assert.deepEqual(guards, [
    { 'sourceNativeExperienceConflict.kind': { $eq: 'native-sidebar-and-own-role-description' } },
    { 'sourceNativeExperienceConflict.sidebar': { $eq: '6-7' } },
    { 'sourceNativeExperienceConflict.ownRoleRequirement': { $eq: '6 - 8 years' } },
  ])
})

test('classification snapshots match reordered native conflict evidence through the strict schema and reject changed leaves', { timeout: 30000 }, async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } })
  let connection
  t.after(async () => { if (connection) await connection.close(); await mongo.stop() })
  connection = await mongoose.createConnection(mongo.getUri(), { autoCreate: false, autoIndex: false }).asPromise()
  const model = connection.model('NativeConflictSnapshot', Job.schema.clone())
  const current = (await acquire()).sourceNativeExperienceConflict
  const record = { _id: new mongoose.Types.ObjectId(), title: 'Digital Marketing Lead',
    sourceNativeExperienceConflict: { ownRoleRequirement: current.ownRoleRequirement, sidebar: current.sidebar, kind: current.kind } }
  const cast = new Job(record).toObject()
  assert.notDeepEqual(Object.keys(record.sourceNativeExperienceConflict), Object.keys(cast.sourceNativeExperienceConflict),
    'the native BSON and schema controls must actually exercise different embedded field orders')
  const canonical = sourceSnapshotFilter({ _id: record._id, title: record.title,
    sourceNativeExperienceConflict: cast.sourceNativeExperienceConflict })
  const reordered = sourceSnapshotFilter(record)
  await model.collection.insertOne(record)
  assert.equal(await model.countDocuments(canonical), 1, 'the actual Mongoose CAS must match unchanged raw BSON evidence')
  assert.deepEqual(mongoose.mongo.BSON.serialize(canonical), mongoose.mongo.BSON.serialize(reordered),
    'equivalent source evidence must produce the same BSON snapshot regardless of embedded key order')
  for (const [leaf, changed] of [['kind', 'changed-native-contract'], ['sidebar', '6-9'], ['ownRoleRequirement', '6-10 years']]) {
    await model.collection.updateOne({ _id: record._id }, { $set: { ['sourceNativeExperienceConflict.' + leaf]: changed } })
    assert.equal(await model.countDocuments(canonical), 0, 'changed ' + leaf + ' must invalidate the source snapshot')
    await model.collection.updateOne({ _id: record._id }, { $set: { ['sourceNativeExperienceConflict.' + leaf]: current[leaf] } })
    assert.equal(await model.countDocuments(canonical), 1)
  }
  const absent = { _id: new mongoose.Types.ObjectId(), title: 'A no-conflict snapshot control' }
  const missingSnapshot = sourceSnapshotFilter(absent)
  await model.collection.insertOne(absent)
  assert.equal(await model.countDocuments(missingSnapshot), 1)
  await model.collection.updateOne({ _id: absent._id }, { $set: { sourceNativeExperienceConflict: null } })
  assert.equal(await model.countDocuments(missingSnapshot), 1, 'null and missing evidence both retain absent conflict leaves')
  await model.collection.updateOne({ _id: absent._id }, { $set: { sourceNativeExperienceConflict: current } })
  assert.equal(await model.countDocuments(missingSnapshot), 0, 'new conflict evidence must invalidate an absent-marker snapshot')
})

test('the real persistence whitelist and strict schema retain the original conflict for reclassification', async () => {
  const job = await acquire()
  const persistenceURL = new URL('../scraper-support/utils/saveToDB.js', import.meta.url).href
  const modelURL = new URL('../src/models/Job.js', import.meta.url).href
  const classificationURL = new URL('../src/services/jobClassificationPolicy.js', import.meta.url).href
  const script = `
    import assert from 'node:assert/strict';
    import {registerHooks} from 'node:module';
    let writes=[];
    globalThis.nativeConflictPersistence={bulkWrite:async operations=>{writes.push(...operations);return{upsertedCount:operations.length,modifiedCount:0}}};
    registerHooks({resolve(specifier,context,next){
      if(context.parentURL===${JSON.stringify(persistenceURL)}&&specifier==='../../db/db.js') return{url:'data:text/javascript,export default async()=>{}',shortCircuit:true};
      if(context.parentURL===${JSON.stringify(persistenceURL)}&&specifier==='../../src/models/Job.js') return{url:'data:text/javascript,export default globalThis.nativeConflictPersistence',shortCircuit:true};
      return next(specifier,context);
    }});
    const {default:mongoose}=await import('mongoose');
    mongoose.connect=async()=>assert.fail('A real database connection is forbidden');
    globalThis.fetch=async()=>assert.fail('Network is forbidden');
    const {saveToDB}=await import(${JSON.stringify(persistenceURL)});
    const {default:Job}=await import(${JSON.stringify(modelURL)});
    const {resolveClassification}=await import(${JSON.stringify(classificationURL)});
    const job=${JSON.stringify(job)};
    // The historical test clock makes this original September posting eligible
    // solely for the isolated persistence control; its authored date is unchanged.
    await saveToDB([job],job.source,{now:new Date('2026-09-17T00:00:00Z'),enrichPublicExperience:false,
      descriptionRewriteMode:'off',replaceExisting:false,refreshDatasetSummary:false,enqueueAlerts:false});
    assert.equal(writes.length,1);
    const fields=writes[0].updateOne.update.$set;
    assert.deepEqual(fields.sourceNativeExperienceConflict,job.sourceNativeExperienceConflict);
    const stored=new Job(fields).toObject();
    assert.deepEqual(stored.sourceNativeExperienceConflict,job.sourceNativeExperienceConflict);
    assert.equal(stored.experienceRequired,null);
    assert.equal(stored.experienceProfile.minimumYears,null);
    assert.equal(stored.experienceProfile.maximumYears,null);
    const classified=resolveClassification(stored,null,{mode:'policy'});
    assert.equal(classified.resolved.experienceProfile.minimumYears,null);
    assert.equal(classified.resolved.experienceProfile.maximumYears,null);
    assert.deepEqual(classified.resolved.experienceYears,[]);
    assert.equal(mongoose.connection.readyState,0);
    assert.equal(mongoose.connection.db,undefined);
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 15000, windowsHide: true,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr || result.stdout)
})

test('ordinary matching native criteria retain their original numeric profile', async () => {
  const job = await acquire({ matching: true })
  assert.equal(job.sourceNativeExperienceConflict, null)
  const normalized = normalizeScrapedJob(job)
  assert.equal(normalized.experienceProfile.minimumYears, 6)
  assert.equal(normalized.experienceProfile.maximumYears, 8)
  assert.equal(normalized.experienceProfile.confidence, 'high')
  assert.deepEqual(normalized.experienceYears, [6, 7, 8])
  const ordinary = extractJobFilterSignals({ description: 'Required experience: 4-6 years of overall software development experience.', sourceExperienceScopeUnresolved: true })
  assert.equal(ordinary.experienceProfile.minimumYears, 4)
  assert.equal(ordinary.experienceProfile.maximumYears, 6)
  assert.equal(ordinary.experienceProfile.confidence, 'high')
})
