import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import Job from '../../src/models/Job.js'
import { generateFingerprint, saveToDB as persistJobs } from '../utils/saveToDB.js'

// These persistence fixtures stub MongoDB; transactional alert behavior has its own replica-set suite.
const saveToDB = (jobs, source, options = {}) => persistJobs(jobs, source, { enqueueAlerts: false, ...options })
import { extractCurrentElfsightJobs, ELFSIGHT_WIDGET_ID, run } from '../../scraper/remunanceservicespvtltd/script.js'
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/remunanceservicespvtltd/current-widget.json',import.meta.url),'utf8'))
const settings=payload=>payload.data.widgets[ELFSIGHT_WIDGET_ID].data.settings

test('Remunance current 29 public records retain 22 verified India positives with incomplete scope',()=>{
 const jobs=extractCurrentElfsightJobs(fixture())
 assert.equal(jobs.length,22)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceListingComplete===false&&job.applicationUrlIsGeneric===true))
 assert.equal(jobs.find(job=>job.title==='Digital Commerce Specialist').jobDescription,'Experience required: 1-3 years Job Description: candidates having Magento, Open Source, PWA experience Should have Adobe certificate professional Good in communication')
 assert.match(jobs[0].jobDescription,/Willingness to travel occasionally as required\.$/)
})
test('Remunance honors the public widget visibility filter',()=>{
 const payload=fixture();settings(payload).jobs.find(job=>job.location==='Pune').visible=false
 const jobs=extractCurrentElfsightJobs(payload);assert.equal(jobs.length,21)
})
test('Remunance decodes serialized settings just like the first-party loaded widget bootstrap',()=>{
 const payload=fixture();payload.data.widgets[ELFSIGHT_WIDGET_ID].data.settings=JSON.stringify(settings(payload))
 assert.equal(extractCurrentElfsightJobs(payload).length,22)
})
test('Remunance never substitutes widget demo roles for an empty actual inventory',()=>{
 const payload=fixture();const config=settings(payload);config.demoJobs=config.jobs;config.jobs=[]
 assert.throws(()=>extractCurrentElfsightJobs(payload),/incomplete|inventory/i)
})
test('Remunance preaborted transport preserves the original reason without network',async()=>{
 const reason=new Error('Remunance cancelled')
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:()=>assert.fail('network'),fetchJson:()=>assert.fail('network')}),error=>error===reason)
})
test('Remunance shared-form roles survive real persistence while unknown-location roles prevent expiration',async t=>{
 const state=Object.getOwnPropertyDescriptor(mongoose.connection,'readyState')
 Object.defineProperty(mongoose.connection,'readyState',{configurable:true,value:1})
 t.after(()=>{if(state)Object.defineProperty(mongoose.connection,'readyState',state);else delete mongoose.connection.readyState})
 let writes=[],expiryCalls=0
 t.mock.method(Job,'bulkWrite',async operations=>{writes=operations;return{modifiedCount:0,upsertedCount:operations.length}})
 t.mock.method(Job,'updateMany',()=>{expiryCalls++;return{exec:async()=>({modifiedCount:0})}})
 const jobs=extractCurrentElfsightJobs(fixture()).map(job=>({...job,source:'remunanceservicespvtltd',link:job.applyUrl}))
 assert.equal(new Set(jobs.map(generateFingerprint)).size,22)
 await saveToDB(jobs,'remunanceservicespvtltd',{enrichPublicExperience:false,refreshDatasetSummary:false})
 assert.equal(writes.length,22)
 assert.equal(new Set(writes.map(operation=>operation.updateOne.filter.fingerprint)).size,22)
 assert.equal(expiryCalls,0)
})
