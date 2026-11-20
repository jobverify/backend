import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parseCultfitPage,projectCultfitPublishedRole,runCultfitPublication} from './currentPublication20261119.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-publication-20261119.json.gz',import.meta.url))))
const decode=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const first=JSON.parse(decode(fixture.responses.find(r=>r.requestedUrl.endsWith('/jobs/search'))))
const row=first.data.data[0]._source
const now=()=>new Date('2026-11-19T18:00:00.000Z')
function replay(mutate,extra={}){
 const used=new Set()
 return runCultfitPublication({now,requestIntervalMs:0,...extra,fetchImpl:async(url,init)=>{
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const index=fixture.responses.findIndex((r,i)=>!used.has(i)&&r.requestedUrl===url&&r.method===init.method&&(r.requestBody??null)===(init.body??null))
  assert.ok(index>=0,'Unexpected read '+url+' '+init.body)
  used.add(index)
  const original=fixture.responses[index]
  const changed=mutate?.({original,index,text:decode(original),init})??{}
  const response=new Response(changed.text??decode(original),{status:changed.status??original.status,headers:changed.headers??original.headers})
  Object.defineProperties(response,{url:{value:changed.url??original.url},redirected:{value:changed.redirected??false}})
  return response
 }})
}

test('current Cult.fit search unwraps native rows and uses active status despite retained custom Hidden/Closed labels',()=>{
 const page=parseCultfitPage(first)
 assert.equal(page.records.length,10)
 assert.equal(page.total,136)
 assert.equal(row.otherStatusOne,'Hidden');assert.equal(row.otherStatusTwo,'Closed')
 const job=projectCultfitPublishedRole(row,{now:now()})
 assert.equal(job.jobId,String(row.id));assert.equal(job.sourceNativeJobCode,row.jobCode)
 assert.equal(job.country,'India');assert.equal(job.sourceNativeRecord,row)
 assert.equal(job.sourceDetailComplete,false)
 assert.match(job.sourceUrl,new RegExp('\\?id='+row.id+'$'))
})

test('Cult.fit keeps independently published jobs as partial when criteria are absent and retains unknown original fields',()=>{
 const original={...row,shortDescription:null,role:null,newNativeCriteria:{requiresReview:true}}
 const job=projectCultfitPublishedRole(original,{now:now()})
 assert.equal(job.sourceDetailComplete,false);assert.equal(job.jobDescription,null)
 assert.equal(job.sourceNativeRecord,original);assert.deepEqual(job.sourceNativeRecord.newNativeCriteria,{requiresReview:true})
 assert.equal(job.backendApplicationActivationVerified,false);assert.equal(job.postingDate,null)
})

test('Cult.fit requires original wrapper identity and exact scoped native employer and country records',()=>{
 for(const mutate of[
  d=>{d.data.data[0]._id='other-id'},
  d=>{d.data.facetedSearchConfig.companyId='99'},
  d=>{d.data.data[0]._source.companyId=99},
  d=>{d.data.hasMoreData='false'},
  d=>{d.data.totalCount=0},
 ]){const d=structuredClone(first);mutate(d);assert.throws(()=>parseCultfitPage(d))}
 for(const patch of[
  {jobLocationRecord:null},{status:0},{displayStatus:'Closed'},{privateJobShare:'Y'},
  {country:'Canada'},{jobUrl:'../other-role'},
  {jobLocationRecord:row.jobLocationRecord.map(a=>({...a,companyId:99}))},
  {jobLocationRecord:row.jobLocationRecord.map(a=>({...a,country:'United States'}))},
 ])assert.throws(()=>projectCultfitPublishedRole({...row,...patch},{now:now()}))
})

test('Cult.fit checks authored expiry and publication dates without substituting internal creation or modification timestamps',()=>{
 for(const patch of[{endtDate:'2020-01-01'},{validThrough:'2026-02-30'},{datePosted:'2030-01-01'},{isClosed:true}])
  assert.throws(()=>projectCultfitPublishedRole({...row,...patch},{now:now()}))
 const job=projectCultfitPublishedRole({...row,validThrough:'2026-12-31',datePosted:'2026-11-18'},{now:now()})
 assert.equal(job.postingDate,'2026-11-18');assert.equal(job.closingDate,'2026-12-31')
 assert.equal(job.sourceNativeDateFields.modifiedDate,row.modifiedDate)
})

test('Cult.fit reconciles every full current published row and bounded representative details across both passes',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,130);assert.equal(new Set(jobs.map(j=>j.jobId)).size,130)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.sourceClosingQualified&&j.country==='India'))
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.openingRecords.length,136);assert.equal(audit.closingRecords.length,136)
 assert.equal(audit.originalResponses.length,44);assert.equal(audit.heldNativeRows.length,6)
 assert.equal(audit.companyScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.ok(jobs[0].sourceNativeDetailPayload)
})

test('Cult.fit holds changed and removed records at closing without inventing a complete company inventory',async()=>{
 const jobs=await replay(({original,text})=>{
  if(original.phase==='closing'&&original.requestedUrl.endsWith('/jobs/search')){
   const d=JSON.parse(text);if(d.data.data[0]?._source.id===row.id)d.data.data[0]._source.shortDescription+=' changed actual criteria'
   return {text:JSON.stringify(d)}
  }
 })
 assert.equal(jobs.length,129);assert.ok(!jobs.some(j=>j.jobId===String(row.id)))
 assert.ok(jobs.nativeCollectionEvidence.heldNativeRows.some(r=>r.reason.includes('closing')))
 assert.equal(jobs.inventoryEvidence?.listingComplete??false,false)
})

test('Cult.fit rejects incorrect current publisher, declared endpoint, HTTP metadata and incomplete native pagination',async()=>{
 for(const mutate of[
  ({original,text})=>original.requestedUrl.endsWith('/cult/')?{text:text.replace('Careers | Cult.Fit','Different Company')}:null,
  ({original,text})=>/main\..*\.js$/.test(original.requestedUrl)?{text:text.replace('COMPANYID:"MTU0NzA="','COMPANYID:"OTk="')}:null,
  ({original})=>original.requestedUrl.endsWith('/jobs/search')?{status:429}:null,
  ({original})=>original.requestedUrl.endsWith('/jobs/search')?{redirected:true}:null,
  ({original,text})=>original.requestedUrl.endsWith('/jobs/search')?{text:JSON.stringify({...JSON.parse(text),data:{...JSON.parse(text).data,hasMoreData:false}})}:null,
 ])await assert.rejects(replay(mutate))
})

test('Cult.fit preserves opaque caller cancellation and rejects metadata-free injected transports',async()=>{
 const controller=new AbortController(),reason={cancel:'caller'};controller.abort(reason)
 await assert.rejects(runCultfitPublication({signal:controller.signal}),e=>e===reason)
 await assert.rejects(runCultfitPublication({fetchJson:async()=>first}),/metadata/)
})

test('Cult.fit holds contradictory authored workplace and employer signals despite otherwise positive listing fields',()=>{
 for(const patch of[
  {shortDescription:'<p>Location: Boston, Massachusetts, United States</p>'},
  {role:'<p>Employer: Other Company</p>'},
  {hiringOrganization:{name:'Other Company'}},
  {companyName:'Other Company'},
 ])assert.throws(()=>projectCultfitPublishedRole({...row,...patch},{now:now()}))
})

test('Cult.fit qualifies already-fetched representative expiry, workplace and employer contradictions for that role',async()=>{
 for(const patch of [{endtDate:'2020-01-01'},{location:'Boston, Massachusetts, United States'},{companyName:'Other Company'}]){
  const jobs=await replay(({original,text})=>{
   if(original.requestedUrl.endsWith('/careersite')){const d=JSON.parse(text);if(d.id===row.id)return{text:JSON.stringify({...d,...patch})}}
  })
  assert.equal(jobs.length,129);assert.ok(!jobs.some(j=>j.jobId===String(row.id)))
  assert.ok(jobs.nativeCollectionEvidence.heldNativeRows.some(r=>r.id===row.id))
 }
})

test('Cult.fit preserves independently published partial jobs when optional representative hydration is unavailable',async()=>{
 const jobs=await replay(({original})=>original.requestedUrl.endsWith('/careersite')?{status:503}:null)
 assert.equal(jobs.length,130)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false))
 assert.equal(jobs.find(j=>j.jobId===String(row.id)).sourceNativeDetailObservation.httpStatus,503)
 assert.equal(jobs.nativeCollectionEvidence.companyScopeComplete,false)
})
