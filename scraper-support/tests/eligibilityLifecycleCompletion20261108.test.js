import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import mongoose from 'mongoose'
import Job from '../../src/models/Job.js'
import ScraperRun from '../../src/models/ScraperRun.js'
import ScraperStatus from '../../src/models/ScraperStatus.js'
import { isCompleteScraperAttempt } from '../utils/inventoryEvidence.js'
import { finishScraperProcessing, inventoryCleanupOptions } from '../utils/scraperOutcome.js'
import { summarizeScraperRun } from '../utils/scraperRunSummary.js'
import { openRunCheckpoint } from '../utils/runCheckpoint.js'
import { saveToDB } from '../utils/saveToDB.js'
import { upsertScraperStatus, writeScraperRun } from '../utils/scraperPersistence.js'

const now = new Date()
const attempt = () => ({ success:true, jobs:1, rawRecords:1, eligibleJobs:0, filteredOld:1,
  staleCheckSkipped:true, staleCheckReasonCode:'no-eligible-jobs',
  staleCheckReason:'No eligible jobs survived filtering; previous source jobs were preserved without recording lifecycle misses.',
  completedAt:now.toISOString(), inventoryEvidence:{status:'complete-inventory',firstParty:true,
    listingComplete:true,surface:'https://employer.test/jobs',pagesFetched:1,reportedTotal:1,
    indiaFacetCount:1,verifiedAt:now.toISOString()},
  detailHealth:{complete:true,inspectedJobs:1,incompleteJobs:0,missingDescriptions:0,failureKinds:{}} })

const disconnectedModelStubs = t => {
  const descriptor=Object.getOwnPropertyDescriptor(mongoose.connection,'readyState')
  Object.defineProperty(mongoose.connection,'readyState',{configurable:true,value:1})
  t.after(()=>{if(descriptor)Object.defineProperty(mongoose.connection,'readyState',descriptor);else delete mongoose.connection.readyState})
  assert.equal(mongoose.connection.db == null,true,'No real database is available to this fixture')
}

test('complete extraction remains complete when only eligibility cleanup is held',()=>{
  const value=attempt()
  assert.equal(isCompleteScraperAttempt(value,{now}),true)
  const finished=finishScraperProcessing(value)
  assert.notEqual(finished.partial,true)
  assert.equal(finished.staleCheckSkipped,true)
  assert.deepEqual(inventoryCleanupOptions(finished),{replaceExisting:false})
  assert.equal(summarizeScraperRun([finished]).extractionChecks.complete,1)
})

test('an eligibility hold cannot override missing, stale, failed or incomplete extraction evidence',()=>{
  const base=attempt()
  for(const patch of [
    {staleCheckReasonCode:undefined}, {eligibleJobs:1}, {eligibleJobs:null},
    {detailHealth:{...base.detailHealth,complete:false}}, {detailHealth:null},
    {inventoryEvidence:null}, {inventoryEvidence:{...base.inventoryEvidence,listingComplete:false}},
    {inventoryEvidence:{...base.inventoryEvidence,verifiedAt:new Date(+now-49*3600000).toISOString()}},
    {success:false}, {partial:true}, {softFailure:true}, {failureKind:'incomplete_listing'},
    {zeroJobEvidence:'coverage-gap'}, {filteredEmptyDescription:1},
  ]) assert.equal(isCompleteScraperAttempt({...base,...patch},{now}),false,JSON.stringify(patch))
})

test('history aliases retain complete extraction without authorizing cleanup',()=>{
  const value=attempt(); delete value.eligibleJobs; value.eligibleJobsFound=0
  assert.equal(isCompleteScraperAttempt(value,{now}),true)
})

test('the real saver holds old-only lifecycle cleanup and emits its reason code',async t=>{
  disconnectedModelStubs(t)
  const unexpected=()=>{throw new Error('Old-only inventory must not write or retire jobs')}
  for(const method of ['find','bulkWrite','deleteMany','updateMany'])t.mock.method(Job,method,unexpected)
  const result=await saveToDB([{jobId:'old-role',title:'Engineer',company:'Employer',source:'hold-fixture',
    location:'Bengaluru, India',applyUrl:'https://employer.test/jobs/old-role',postingDate:new Date(+now-100*86400000).toISOString(),
    sourceDescription:'Build and maintain reliable software systems and support customers through the full development lifecycle.',
    sourceListingComplete:true,sourceDetailComplete:true}], 'hold-fixture',
    {now,enrichPublicExperience:false,descriptionRewriteMode:'off',enqueueAlerts:false})
  assert.equal(result.eligibleJobs,0)
  assert.equal(result.filteredOld,1)
  assert.equal(result.staleCheckSkipped,true)
  assert.equal(result.staleCheckReasonCode,'no-eligible-jobs')
  assert.equal(result.inserted,0);assert.equal(result.updated,0)
  assert.equal(result.deleted,0);assert.equal(result.missed,0);assert.equal(result.expired,0)
  assert.equal(isCompleteScraperAttempt({...attempt(),...result},{now}),true)
})

test('the cleanup hold survives checkpoint serialization',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scraper-eligibility-hold-'))
  try{
    const options={filePath:path.join(dir,'checkpoint.json'),sources:['hold-fixture'],mode:'live',parallel:false}
    openRunCheckpoint(options).markSourceCompleted('hold-fixture',attempt())
    const result=openRunCheckpoint(options).completedSummary()['hold-fixture']
    assert.equal(result.staleCheckReasonCode,'no-eligible-jobs')
    assert.equal(isCompleteScraperAttempt(result,{now}),true)
  }finally{
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()))
    assert.match(path.basename(dir),/^scraper-eligibility-hold-/)
    fs.rmSync(dir,{recursive:true,force:true})
  }
})

test('status and history preserve the hold and record the completed extraction',async t=>{
  disconnectedModelStubs(t)
  let update,payload
  t.mock.method(ScraperStatus,'findOneAndUpdate',async(_query,value)=>{update=value})
  t.mock.method(ScraperRun,'create',async value=>{payload=new ScraperRun(value).toObject()})
  await upsertScraperStatus('hold-fixture',attempt())
  assert.equal(update.$set.latestAttempt.staleCheckReasonCode,'no-eligible-jobs')
  assert.ok(update.$set.lastCompleteCheckAt instanceof Date,'Complete extraction must update its completion clock')
  assert.equal(update.$set.lastCompleteCheckAt.toISOString(),now.toISOString())
  await writeScraperRun(now,{'hold-fixture':attempt()})
  const result=payload.sources.get('hold-fixture')
  assert.equal(result.staleCheckReasonCode,'no-eligible-jobs')
  assert.equal(result.staleCheckSkipped,true)
  assert.equal(payload.overall.extractionChecks.complete,1)
})

const currentRole = flags => ({jobId:'current-role',title:'Engineer',company:'Employer',source:'explicit-hold-fixture',
  country:'India',location:'Bengaluru, India',applyUrl:'https://careers.example.com/jobs/current-role',postingDate:now.toISOString(),
  sourceDescription:'Build and maintain reliable software systems and support customers through the full development lifecycle.',
  sourceListingComplete:true,sourceDetailComplete:true,...flags})
const saverOptions={now,enrichPublicExperience:false,descriptionRewriteMode:'off',enqueueAlerts:false,refreshDatasetSummary:false}

for(const flags of [{lifecycleCleanupAllowed:false},{sourceScopeComplete:false},{lifecycleCleanupAllowed:false,sourceScopeComplete:false}]) {
  test('the real saver respects explicit native cleanup holds '+JSON.stringify(flags),async t=>{
    disconnectedModelStubs(t)
    let writes=0
    t.mock.method(Job,'bulkWrite',async operations=>{writes++;assert.equal(operations.length,1);return {upsertedCount:1,modifiedCount:0}})
    for(const method of ['find','deleteMany','updateMany'])t.mock.method(Job,method,()=>{throw new Error('Explicitly held source must not query or retire previous jobs')})
    const result=await saveToDB([currentRole(flags)],'explicit-hold-fixture',saverOptions)
    assert.equal(result.eligibleJobs,1);assert.equal(writes,1);assert.equal(result.inserted,1)
    assert.equal(result.staleCheckSkipped,true);assert.equal(result.staleCheckReasonCode,'source-cleanup-forbidden')
    assert.equal(result.deleted,0);assert.equal(result.missed,0)
    assert.deepEqual(inventoryCleanupOptions({...attempt(),...result}),{replaceExisting:false})
  })
}

test('an old-only native source hold cannot become an eligibility-only extraction exception',async t=>{
  disconnectedModelStubs(t)
  for(const method of ['find','bulkWrite','deleteMany','updateMany'])t.mock.method(Job,method,()=>{throw new Error('Old-only held source must not write or retire jobs')})
  const result=await saveToDB([{...currentRole({lifecycleCleanupAllowed:false}),postingDate:new Date(+now-100*86400000).toISOString()}],'explicit-hold-fixture',saverOptions)
  assert.equal(result.eligibleJobs,0);assert.equal(result.staleCheckReasonCode,'source-cleanup-forbidden')
  assert.equal(isCompleteScraperAttempt({...attempt(),...result},{now}),false)
})

test('explicitly complete native sources retain the existing authorized lifecycle behavior',async t=>{
  disconnectedModelStubs(t)
  let deletions=0,misses=0
  t.mock.method(Job,'bulkWrite',async()=>({upsertedCount:1,modifiedCount:0}))
  t.mock.method(Job,'deleteMany',()=>({exec:async()=>{deletions++;return {deletedCount:0}}}))
  t.mock.method(Job,'updateMany',()=>({exec:async()=>{misses++;return {modifiedCount:2}}}))
  const result=await saveToDB([currentRole({sourceScopeComplete:true,lifecycleCleanupAllowed:true})],'explicit-hold-fixture',saverOptions)
  assert.equal(result.eligibleJobs,1);assert.equal(result.inserted,1)
  assert.equal(result.staleCheckSkipped,false);assert.equal(deletions,1);assert.equal(misses,1);assert.equal(result.missed,2)
})
