import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readDaloopaClient,runCurrentDaloopaData} from './nativeData20261115.js'
import {createDaloopaReplay,withDaloopaReplayClock} from './fixtures/replayNativeData20261115.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {createHash} from 'node:crypto'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-client-20261125.json.gz',import.meta.url))))
const response=fixture.responses[1],bytes=Buffer.from(response.body)
const page=(body=bytes)=>({label:'client',url:response.requestedUrl,method:'GET',requestBody:null,bytes:body,text:body.toString('utf8')})
const failure=error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false

test('one genuine current registered ten-read pass retains the remaining full India role without claiming empty company scope',async()=>{
 const current=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-single-role-20261125.json.gz',import.meta.url))))
 const provider=getScraperCatalog().find(row=>row.source==='daloopa');let count=0
 const jobs=await withDaloopaReplayClock(()=>createCatalogScraper(provider).run({fetchImpl:async(url,init)=>{
  const row=current.responses[count++]
  assert.ok(row,'Only the actual bounded current pass')
  assert.equal(String(url),row.requestedUrl)
  assert.equal(init.method,row.method)
  assert.equal(init.body,row.requestBody??undefined)
  assert.equal(createHash('sha256').update(row.body).digest('hex'),row.bodySHA256)
  return Object.defineProperty(new Response(row.body,{status:row.status,headers:row.headers}),'url',{value:row.url})
 }}))
 assert.equal(count,10)
 assert.deepEqual(jobs.map(job=>job.jobId),['45'])
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].formalLegalEmployerQualified,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeObservedRecordCount,8)
 const assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.runnerOutcome.success,true)
 assert.equal(assessment.eligibleJobs,0)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('actual current client preserves employer and routes after two disabled applicant controls',()=>{
 const client=readDaloopaClient(page())
 assert.equal(client.clientId,1165)
 assert.equal(client.clientName,'Daloopa Private Limited')
 assert.equal(client.formalLegalEmployerQualified,false)
 assert.equal(Object.hasOwn(client,'cookie'),false)
})

test('current client with retained independent native data keeps all qualification holds in a composite replay',async()=>{
 const io=createDaloopaReplay((original,packet)=>packet.label==='client'?bytes:original)
 const jobs=await withDaloopaReplayClock(()=>runCurrentDaloopaData({fetchImpl:io.fetchImpl}))
 assert.deepEqual(jobs.map(job=>job.jobId),['46','45'])
 assert.equal(io.calls.length,14)
 for(const job of jobs){
  assert.equal(job.country,'India')
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.formalLegalEmployerQualified,false)
  assert.equal(job.sourceCorporateBindingQualified,false)
  assert.equal(job.sourceApplicationQualificationComplete,false)
  assert.equal(job.activationVerified,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.applyUrl,null)
 }
 assert.equal(jobs.nativeCollectionEvidence.nativeClient.carrierSHA256,jobs.nativeCollectionEvidence.nativeClosingClient.carrierSHA256)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
})

for(const[name,change]of[
 ['employer',value=>value.clientName='Other employer'],
 ['public route',value=>value.tenantPreferencesMap.career_page_url.url[0].url='https://example.org/'],
 ['applicant question validation',value=>value.tenantPreferencesMap.form_fields.applicants[25].mandatory=true],
 ['unreviewed control',value=>value.extraValidation=true],
])test('finite current client still rejects changed '+name,()=>{
 const value=JSON.parse(response.body);change(value)
 assert.throws(()=>readDaloopaClient(page(Buffer.from(JSON.stringify(value)))),failure)
})

test('opening and closing may not silently mix the two reviewed client revisions',async()=>{
 const io=createDaloopaReplay((original,packet)=>packet.label==='client'&&packet.phase==='opening'?bytes:original)
 await withDaloopaReplayClock(()=>assert.rejects(runCurrentDaloopaData({fetchImpl:io.fetchImpl}),failure))
})

test('one independently qualified India role survives a smaller current native inventory',async()=>{
 const io=createDaloopaReplay((original,packet)=>{
  if(packet.label!=='listing')return original
  const value=JSON.parse(original)
  value.reqDetailsBOList=value.reqDetailsBOList.filter(row=>row.reqId!==46)
  return Buffer.from(JSON.stringify(value))
 })
 const jobs=await withDaloopaReplayClock(()=>runCurrentDaloopaData({fetchImpl:io.fetchImpl}))
 assert.deepEqual(jobs.map(job=>job.jobId),['45'])
 assert.equal(io.calls.length,10)
 assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.physicalReads,10)
 assert.equal(jobs.nativeCollectionEvidence.allOriginalNativeClosingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
})

test('current reviewed replicas reconcile every full data byte while retaining both original version tokens',async()=>{
 const io=createDaloopaReplay((original,packet)=>{
  if(!packet.label.startsWith('detail-'))return original
  return Buffer.from(original.toString().replace(/"v":"[^"]+"/,packet.phase==='opening'
   ? '"v":"d17-ae-20261124072427"':'"v":"d17-8o-20261123230732"'))
 })
 const jobs=await withDaloopaReplayClock(()=>runCurrentDaloopaData({fetchImpl:io.fetchImpl}))
 assert.equal(jobs.length,2)
 for(const job of jobs){
  assert.equal(job.nativeOriginalEnvelope.v,'d17-ae-20261124072427')
  assert.equal(job.nativeClosingOriginalEnvelope.v,'d17-8o-20261123230732')
  assert.equal(job.nativeRawDataSHA256,job.nativeClosingRawDataSHA256)
  assert.deepEqual(job.nativeDetailData,job.nativeClosingDetailData)
  assert.equal(job.activationVerified,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
})

for(const[name,change]of[
 ['unreviewed replica',text=>text.replace('d17-8o-20261123230732','d17-unreviewed-20261123230732')],
 ['changed criteria',text=>text.replace('India (Remote)','United States (Remote)')],
 ['changed native application count',text=>text.replace(/"activeApplicationCount":\s*(\d+)/,(_match,value)=>'"activeApplicationCount":'+(Number(value)+1))],
 ['additional original byte',text=>text+' '],
])test('reviewed replicas cannot hide '+name,async()=>{
 let mutations=0
 const io=createDaloopaReplay((original,packet)=>{
  if(!packet.label.startsWith('detail-'))return original
  let text=original.toString().replace(/"v":"[^"]+"/,packet.phase==='opening'
   ? '"v":"d17-ae-20261124072427"':'"v":"d17-8o-20261123230732"')
  if(packet.phase==='closing'){const changed=change(text);if(changed!==text)mutations++;text=changed}
  return Buffer.from(text)
 })
 await withDaloopaReplayClock(()=>assert.rejects(runCurrentDaloopaData({fetchImpl:io.fetchImpl}),failure))
 assert.ok(mutations>0,'Counterfactual must change an actual original closing entity')
})
