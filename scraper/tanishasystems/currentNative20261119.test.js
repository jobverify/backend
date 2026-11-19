import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test, { mock } from 'node:test'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
import { run } from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const replay=change=>{
 let count=0
 return {reads:()=>count,fetchImpl:async(url,init)=>{
  const page=structuredClone(fixture.originals[count++%fixture.originals.length])
  assert.equal(url,page.requestedURL)
  change?.(page,count,init)
  const response=new Response(Buffer.from(page.bodyBase64,'base64'),{status:page.status,headers:page.headers})
  Object.defineProperty(response,'url',{value:page.finalURL})
  return response
 }}
}

test('all 15 genuine native notices retain their own full criteria, popup identity and mail handoff without claiming company India inventory',async()=>{
 const io=replay(),network=mock.method(globalThis,'fetch',io.fetchImpl)
 try{
  const jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0})
  assert.equal(jobs.length,15)
  assert.equal(io.reads(),36)
  assert.equal(new Set(jobs.map(job=>job.jobId)).size,15)
  assert.equal(jobs[7].title,'Scrum Master')
  assert.ok(jobs[7].jobDescription.includes('Facilitating daily stand-up meetings'))
  for(const [i,job]of jobs.entries()){
   assert.equal(job.nativeId,`popup-container${i+1}`)
   assert.equal(job.sourceUrl,`https://www.tanishasystems.com/currentopenings.html#popup-container${i+1}`)
   assert.equal(job.applyUrl,job.sourceUrl)
   assert.equal(job.sourceApplicationEmail,'jobs@tanishasystems.com')
   assert.ok(job.jobDescription.length>400)
   assert.equal(job.country,'United States')
   assert.ok(job.location)
   assert.equal(job.requisitionId,null)
   assert.equal(job.postingDate,null)
   assert.equal(job.closingDate,null)
   assert.equal(job.sourceScopeComplete,false)
   assert.equal(job.lifecycleCleanupAllowed,false)
   assert.ok(job.sourceOriginalModel.card)
   assert.ok(job.sourceOriginalModel.popup)
  }
  assert.equal(jobs[12].city,null)
  assert.equal(jobs[0].sourceDetailLocation,'Iselin, NJ or unanticipated client sites within the U.S.')
  assert.equal(jobs[12].sourceLocationConflict,true)
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  const assessment=assessSoftFailureAcquisition({source:'tanishasystems'},jobs)
  assert.equal(assessment.indiaJobs,0)
  assert.equal(assessment.zeroJobEvidence,'fetched-zero')
  assert.equal(assessment.runnerOutcome.success,true)
  assert.equal(assessment.cleanupOptions.replaceExisting,false)
  assert.equal(jobs.nativeCollectionEvidence.fullNativeClosingEqual,true)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
  assert.equal(jobs.nativeCollectionEvidence.applicationInteractions,0)
 }finally{network.mock.restore()}
})

for(const mutation of ['closed','country','criteria','employer','hidden','carrier','client','stylesheet','closing']){
 test(`current native ${mutation} change cannot produce a successful configured zero`,async()=>{
  const io=replay((page,index)=>{
   const body=Buffer.from(page.bodyBase64,'base64').toString('utf8')
   if(mutation==='client'&&index===18)page.bodyBase64=Buffer.from(body+'\nfetch("https://unreviewed.invalid/jobs")').toString('base64')
   else if(mutation==='stylesheet'&&index===9)page.bodyBase64=Buffer.from(body+'\n.box{display:none}').toString('base64')
   else if(mutation==='closing'&&index===19)page.bodyBase64=Buffer.from(body.replace('5 years of work experience','8 years of work experience')).toString('base64')
   else if(index===1&&['closed','country','criteria','employer','hidden','carrier'].includes(mutation)){
    const next={closed:body.replace('Software Developer</div>','Software Developer - position closed</div>'),country:body.replace('Iselin, NJ or unanticipated client sites within the U.S.','Bengaluru, India'),criteria:body.replace('Design, develop and deploy software applications.','See attachment.'),employer:body.replace('Tanisha Systems, Inc., 99 Wood Avenue South','Different Company, 99 Wood Avenue South'),hidden:body.replace('class="col-sm-4 box"','class="col-sm-4 box" hidden'),carrier:body.replace('#popup-container1"','#wrong-popup"')}[mutation]
    assert.notEqual(next,body)
    page.bodyBase64=Buffer.from(next).toString('base64')
   }
  }),network=mock.method(globalThis,'fetch',io.fetchImpl)
  try{await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/profile changed|native.*changed|closing changed/i)}finally{network.mock.restore()}
 })
}

test('HTTP denial preserves the native status and cannot become an empty inventory',async()=>{
 const io=replay(page=>{page.status=403}),network=mock.method(globalThis,'fetch',io.fetchImpl)
 try{await assert.rejects(run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>error.status===403||error.httpStatus===403);assert.equal(io.reads(),1)}finally{network.mock.restore()}
})

test('pre-aborted native acquisition preserves an opaque caller reason without a read',async()=>{
 const caller=new AbortController(),reason=Object.freeze({owner:'tanisha-native'});caller.abort(reason)
 const io=replay(),network=mock.method(globalThis,'fetch',io.fetchImpl)
 try{await assert.rejects(run({signal:caller.signal,fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>error===reason);assert.equal(io.reads(),0)}finally{network.mock.restore()}
})

test('changing transport Date headers retain both originals without changing the whole native model',async()=>{
 const io=replay((page,index)=>{page.headers.date=new Date(Date.UTC(2026,10,19,0,0,index)).toUTCString()}),network=mock.method(globalThis,'fetch',io.fetchImpl)
 try{
  const jobs=await run({fetchImpl:io.fetchImpl,requestIntervalMs:0})
  assert.equal(jobs.length,15)
  const models=jobs.nativeCollectionEvidence.originalModels
  assert.notEqual(models.opening.documents[0].original.headers.date,models.closing.documents[0].original.headers.date)
  assert.equal(models.opening.documents[0].original.bodyBase64,models.closing.documents[0].original.bodyBase64)
  assert.equal(jobs.nativeCollectionEvidence.fullNativeClosingEqual,true)
 }finally{network.mock.restore()}
})
