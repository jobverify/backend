import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {fileURLToPath} from 'node:url'
import mongoose from 'mongoose'
import {MongoMemoryServer} from 'mongodb-memory-server'
import Job from '../src/models/Job.js'
import {saveToDB} from '../scraper-support/utils/saveToDB.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {normalizeJobListResponseJob,getJobMeta,JOB_LIST_CARD_PROJECTION} from '../src/controllers/jobController.js'
import {getRelatedJobs} from '../src/controllers/relatedJobController.js'
import {buildJobFilterConditions,jobMatchesSavedFilters} from '../src/services/jobFilterMatcher.js'
import {PUBLIC_WORK_ARRANGEMENT_EXPRESSION} from '../src/utils/publicWorkArrangement.js'
import {getPublicCompanyByKey} from '../src/services/companyDirectoryService.js'
import {readHiringSnapshot} from '../src/services/hiringObservationService.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/eightfold-work-arrangement-source-20261111.json.gz',import.meta.url))))
const now = new Date('2026-11-11T07:20:00.000Z')
let mongo, originalFetch, seeded
const response = () => ({code:200,set(){return this},status(code){this.code=code;return this},json(body){this.body=body;return this}})

before(async () => {
  assert.equal(mongoose.connection.readyState,0)
  mongo = await MongoMemoryServer.create({instance:{ip:'127.0.0.1'},binary:{version:'8.2.6',
    downloadDir:fileURLToPath(new URL('../.cache/mongodb-binaries/',import.meta.url))}})
  const uri = mongo.getUri()
  assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:\d+\//)
  await mongoose.connect(uri,{autoIndex:false,autoCreate:false})
  originalFetch = globalThis.fetch
  globalThis.fetch = async () => {throw Error('No public/production request in isolated work-mode persistence tests')}
  seeded = fixture.jobs.map((job,index) => ({...normalizeScrapedJob(structuredClone(job)),
    _id:new mongoose.Types.ObjectId(),fingerprint:'offline-native-mode-'+index,
    companyKey:job.company.toLowerCase(),workArrangement:index===0?'Hybrid':'On-site',
    sourceRemoteStatusUnresolved:true,remoteStatus:null,status:'active',isPublicIndia:true,
    postedAt:now,sortDate:now}))
  await Job.collection.insertMany(seeded)
})

after(async () => {
  globalThis.fetch = originalFetch
  await mongoose.disconnect()
  await mongo?.stop()
})

test('real Mongo expressions and saved filters exclude actual flagged unknown jobs from all known modes',async () => {
  for(const workArrangement of ['Hybrid','On-site','Remote']){
    assert.equal((await Job.find(buildJobFilterConditions({workArrangement})).lean()).length,0)
    assert.equal(seeded.filter(job=>jobMatchesSavedFilters({job,filters:{workArrangement},ignoreProfileEligibility:true})).length,0)
  }
  const rows=await Job.aggregate([{$project:{value:PUBLIC_WORK_ARRANGEMENT_EXPRESSION}}])
  assert.ok(rows.length===3&&rows.every(row=>row.value===null))
  const snapshot=await readHiringSnapshot({experiencedJobsEnabled:true})
  assert.ok(snapshot.arrangements.length > 0)
  assert.ok(snapshot.arrangements.every(row=>row.label==='Not specified'))
})

test('real Mongo native-mode branch honors canonical source metadata and rejects technical metadata',async () => {
  // Artificial metadata controls in isolated Mongo, never vacancy evidence.
  const id=seeded[0]._id
  try{
    for(const [remoteStatus,expected] of [['rEmOtE','Remote'],['Hybrid','Hybrid'],['on site','On-site'],['hybrid integration patterns',null],['not remote',null]]){
      await Job.updateOne({_id:id},{$set:{remoteStatus,workArrangement:'Hybrid'}})
      const [actual]=await Job.aggregate([{$match:{_id:id}},{$project:{value:PUBLIC_WORK_ARRANGEMENT_EXPRESSION}}])
      assert.equal(actual.value,expected)
      for(const workArrangement of ['Hybrid','Remote','On-site']){
        const matches=await Job.find({...buildJobFilterConditions({workArrangement}),_id:id}).lean()
        assert.equal(matches.length,expected===workArrangement?1:0)
      }
    }
  }finally{await Job.updateOne({_id:id},{$set:{remoteStatus:null,workArrangement:'Hybrid'}})}
})

test('compact Mongo card projection preserves the native guard before public normalization',async () => {
  const rows=await Job.find({}).select(JOB_LIST_CARD_PROJECTION).lean()
  assert.equal(rows.length,3)
  for(const row of rows){
    assert.equal(row.sourceRemoteStatusUnresolved,true)
    assert.equal(row.remoteStatus,null)
    assert.equal(normalizeJobListResponseJob(row).workArrangement,null)
  }
})

test('scoped metadata does not map the unknown aggregate bucket back to On-site',async () => {
  const res=response()
  await getJobMeta({query:{company:'DSM-Firmenich'},user:{role:'admin'},siteSettings:{experiencedJobsEnabled:true}},res)
  assert.equal(res.code,200)
  assert.deepEqual(res.body.data.workArrangements,[])
})

test('company summaries and recent-job cards retain unknown arrangements',async () => {
  const company=await getPublicCompanyByKey({companyKey:'dsm-firmenich',siteSettings:{experiencedJobsEnabled:true}})
  assert.ok(company)
  assert.deepEqual(company.company.workArrangements,[])
  assert.equal(company.recentJobs.length,2)
  assert.ok(company.recentJobs.every(job=>job.workArrangement===null))
})

test('related-job compact projection cannot publish an old derived work mode',async () => {
  const res=response()
  await getRelatedJobs({params:{id:String(seeded[1]._id)},siteSettings:{experiencedJobsEnabled:true}},res,error=>{throw error})
  assert.equal(res.code,200)
  assert.equal(res.body.data.sameCompany.length,1)
  assert.equal(res.body.data.sameCompany[0].workArrangement,null)
})

test('actual saveToDB into isolated loopback Mongo preserves unknown flag, null mode and all original source criteria',async () => {
  assert.equal(mongoose.connection.host,'127.0.0.1')
  await Job.deleteMany({})
  for(const source of ['bayer','dsmfirmenich']){
    const jobs=fixture.jobs.filter(job=>job.source===source).map(job=>structuredClone(job))
    await saveToDB(jobs,source,{now,enrichPublicExperience:false,enqueueAlerts:false,
      descriptionRewriteMode:'off',replaceExisting:false,refreshDatasetSummary:false})
  }
  const rows=await Job.find({}).lean()
  assert.equal(rows.length,3)
  for(const row of rows){
    const original=fixture.jobs.find(job=>String(job.jobId)===String(row.jobId))
    assert.ok(original)
    assert.equal(row.sourceRemoteStatusUnresolved,true)
    assert.equal(row.remoteStatus,null)
    assert.equal(row.workArrangement,null)
    assert.equal(row.sourceDescription,original.sourceDescription)
  }
})

test('missing-detail fallbacks retain prior opted-in work-mode evidence and accept fresh canonical evidence',async () => {
  const original=fixture.jobs[0]
  assert.equal(mongoose.connection.host,'127.0.0.1')
  await Job.deleteMany({source:original.source})
  const options={now,enrichPublicExperience:false,enqueueAlerts:false,
    descriptionRewriteMode:'off',replaceExisting:false,refreshDatasetSummary:false}
  // Artificial metadata/fallback controls on exact captured source content,
  // confined to the isolated loopback database.
  for(const flag of ['preserveExistingSourceContent','preserveExistingSourceDescription']){
    for(const remoteStatus of [null,'Remote']){
      await saveToDB([{...original,remoteStatus}],original.source,options)
      const sparse={...original,[flag]:true}
      for(const key of ['sourceDescription','jobDescription','description','remoteStatus','sourceRemoteStatusUnresolved'])delete sparse[key]
      await saveToDB([sparse],original.source,options)
      let row=await Job.findOne({jobId:original.jobId}).lean()
      assert.equal(row.sourceRemoteStatusUnresolved,true,flag)
      assert.equal(row.remoteStatus,remoteStatus,flag)
      assert.equal(row.workArrangement,remoteStatus,flag)
      assert.equal(row.sourceDescription,original.sourceDescription,flag)
      await saveToDB([{...sparse,remoteStatus:'Hybrid'}],original.source,options)
      row=await Job.findOne({jobId:original.jobId}).lean()
      assert.equal(row.sourceRemoteStatusUnresolved,true,flag)
      assert.equal(row.remoteStatus,'Hybrid',flag)
      assert.equal(row.workArrangement,'Hybrid',flag)
      assert.equal(row.sourceDescription,original.sourceDescription,flag)
      // Retain the same primary source address used by the persistence key.
      await saveToDB([{...sparse,locations:[original.location,'Remote, no on-site work - India']}],original.source,options)
      row=await Job.findOne({jobId:original.jobId}).lean()
      assert.equal(row.sourceRemoteStatusUnresolved,true,flag)
      assert.equal(row.remoteStatus,'Remote',flag)
      assert.equal(row.workArrangement,'Remote',flag)
    }
  }
})
