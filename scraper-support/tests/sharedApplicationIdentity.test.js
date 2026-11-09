import assert from 'node:assert/strict'
import test from 'node:test'
import mongoose from 'mongoose'
import Job from '../../src/models/Job.js'
import { generateFingerprint, saveToDB as persistJobs } from '../utils/saveToDB.js'

// These persistence fixtures stub MongoDB; transactional alert behavior has its own replica-set suite.
const saveToDB = (jobs, source, options = {}) => persistJobs(jobs, source, { enqueueAlerts: false, ...options })
const role = (id,title='Software Engineer') => ({jobId:id,requisitionId:id,title,company:'Example',country:'India',city:'Bangalore',location:'Bangalore, India',sourceUrl:'https://example.com/careers',applyUrl:'https://forms.gle/example',applicationUrlIsGeneric:true,sourceListingComplete:false})
test('distinct roles sharing one application form remain distinct in the same city',()=>{
 assert.notEqual(generateFingerprint(role('engineering')),generateFingerprint(role('testing','QA Engineer')))
 assert.equal(generateFingerprint(role('engineering')),generateFingerprint({...role('engineering'),title:'Software Engineer II',city:'Bengaluru',location:'Bengaluru, India'}))
})
test('ordinary role-specific URLs keep their existing fingerprint',()=>{
 const job={...role('engineering'),applicationUrlIsGeneric:false,applyUrl:'https://example.com/jobs/engineering'}
 assert.equal(generateFingerprint(job),generateFingerprint({...job,jobId:'changed-id',requisitionId:'changed-id',title:'Changed title'}))
 assert.equal(generateFingerprint(job).length,64)
})
test('persistence writes both generic-form roles and preserves the incomplete snapshot', async()=>{
 const originalState=Object.getOwnPropertyDescriptor(mongoose.connection,'readyState')
 Object.defineProperty(mongoose.connection,'readyState',{configurable:true,value:1})
 const originalBulk=Job.bulkWrite,originalUpdate=Job.updateMany;let writes=[],cleanup=0
 Job.bulkWrite=async operations=>{writes=operations;return {upsertedCount:operations.length,modifiedCount:0}}
 Job.updateMany=()=>{cleanup++;return {exec:async()=>({modifiedCount:0})}}
 try{
  const result=await saveToDB([role('engineering'),role('testing','QA Engineer')],'identity-test',{enrichPublicExperience:false})
  assert.equal(result.inserted,2);assert.equal(writes.length,2)
  assert.equal(new Set(writes.map(x=>x.updateOne.filter.fingerprint)).size,2)
  assert.equal(cleanup,0);assert.equal(result.staleCheckSkipped,true)
 }finally{Job.bulkWrite=originalBulk;Job.updateMany=originalUpdate;if(originalState)Object.defineProperty(mongoose.connection,'readyState',originalState);else delete mongoose.connection.readyState}
})
