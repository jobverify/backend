import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import * as source from './script.js'
import {decode} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
const HOME='https://domino.ai/careers',PORTAL='https://api.careerpuck.com/v1/public/job-boards/domino-data-lab',LIST='https://boards-api.greenhouse.io/v1/boards/dominodatalab/jobs?content=true',DETAIL='https://boards-api.greenhouse.io/v1/boards/dominodatalab/jobs/8103605'
const now=()=> '2026-10-23T16:00:00.000Z'
const realDetail=JSON.parse(Buffer.from(fixture.inputs.find(p=>p.kind==='detail').bodyBase64,'base64'))
globalThis.fetch=()=>{throw Error('Public HTTP blocked in retained fixture tests')}
function replay({edit=(kind,data)=>data,statusFor=()=>200,editHome=html=>html}={}){
 const reads=[];let listings=0
 const fetchImpl=async(url,request)=>{
  let kind=url===HOME?'home':url===PORTAL?'portal':url===DETAIL?'detail':url===LIST?(++listings===1?'listing':'closing'):null
  assert.ok(kind,'Unexpected native request:'+url)
  const p=fixture.inputs.find(p=>p.kind===kind)
  let body=Buffer.from(p.bodyBase64,'base64')
  body=kind==='home'?Buffer.from(editHome(body.toString('utf8'))):Buffer.from(JSON.stringify(edit(kind,JSON.parse(body))))
  reads.push({url,method:request.method,redirect:request.redirect,accept:request.headers.Accept})
  const response=new Response(body,{status:statusFor(kind),headers:{'content-type':p.headers['content-type'],'content-length':String(body.length)}})
  Object.defineProperty(response,'url',{value:url});return response
 }
 return{reads,fetchImpl}
}

test('Domino reuses the native Greenhouse listing/detail contract and preserves the old publication date',async()=>{
 const r=replay(),jobs=await source.run({fetchImpl:r.fetchImpl,now})
 assert.equal(jobs.length,1);const job=jobs[0],batch=job.nativeCollectionEvidence
 assert.equal(job.company,'Domino Data Lab');assert.equal(String(job.jobId),'8103605');assert.equal(job.country,'India');assert.equal(job.location,'Remote India')
 assert.equal(job.title,'Vulnerability Engineer');assert.equal(job.postingDate,'2026-08-05T14:06:01-04:00')
 assert.equal(job.nativePublication.field,'Greenhouse.first_published');assert.equal(job.nativePublication.candidates[1].observation,'observed')
 assert.equal(job.nativeFacts.firstEverPublication,null);assert.equal(job.nativeFacts.nativeGreenhouseDetail.updated_at,'2026-09-15T14:25:56-04:00')
 assert.equal(job.jobDescription,decode(realDetail.content));assert.equal(job.nativeFacts.nativeDescriptionEncoded,realDetail.content)
 assert.equal(job.nativeApplicationURL,null);assert.equal(job.applyUrl,realDetail.absolute_url)
 assert.equal(batch.observedListingCount,22);assert.equal(batch.nativeReportedTotal,22);assert.equal(batch.observedIndiaListingCount,1);assert.equal(batch.nonIndiaListingCount,21)
 assert.equal(batch.candidateDetails,1);assert.equal(batch.jobs.length,1);assert.equal(batch.failures.length,0);assert.equal(batch.closingInventoryMatches,true)
 assert.equal(batch.sourceScopeComplete,false);assert.equal(batch.cleanupAllowed,false)
 assert.deepEqual(r.reads.map(r=>r.url),[HOME,PORTAL,LIST,DETAIL,LIST]);assert.ok(r.reads.every(r=>r.method==='GET'&&r.redirect==='manual'))
 const analysis=analyzePublishableJobs(jobs,{now:new Date(now())});assert.equal(analysis.indiaJobs.length,1);assert.equal(analysis.eligibleJobs.length,0);assert.equal(analysis.filterCounts.old,1)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,22);assert.equal(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)),false)
})

test('Domino synthetic fresh India publication remains eligible without treating edits as publication',async()=>{
 const fresh='2026-10-22T10:00:00Z',r=replay({edit:(kind,data)=>{
  if(['listing','closing'].includes(kind))data.jobs.find(j=>j.id===8103605).first_published=fresh
  if(kind==='detail')data.first_published=fresh
  return data
 }})
 const jobs=await source.run({fetchImpl:r.fetchImpl,now});assert.equal(jobs[0]?.postingDate,fresh)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,1)
})

test('Domino keeps the earlier native publication when listing/detail clocks disagree',async()=>{
 const r=replay({edit:(kind,data)=>{if(['listing','closing'].includes(kind))data.jobs.find(j=>j.id===8103605).first_published='2026-10-22T10:00:00Z';return data}})
 const jobs=await source.run({fetchImpl:r.fetchImpl,now});assert.equal(jobs[0]?.postingDate,realDetail.first_published)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).filterCounts.old,1)
})

test('Domino fetches details only for explicit native India rows',async()=>{
 const r=replay(),jobs=await source.run({fetchImpl:r.fetchImpl,now})
 assert.equal(jobs.length,1);assert.equal(r.reads.filter(r=>/\/jobs\/\d+$/.test(r.url)).length,1)
 assert.equal(jobs[0].nativeCollectionEvidence.nonIndiaListingCount,21)
})

test('Domino requires full detail content and never substitutes the listing description after failure',async()=>{
 const r=replay({edit:(kind,data)=>{if(kind==='detail')data.content='';return data}})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}),e=>{assert.ok(e.nativeEvidence);assert.equal(e.nativeEvidence.sourceScopeComplete,false);return true})
})

for(const [name,change]of [['identity',d=>({...d,id:9999999})],['workplace',d=>({...d,location:{name:'Remote US'}})],['company',d=>({...d,company_name:"Domino's Pizza"})]]){
 test('Domino rejects native detail '+name+' conflicts',async()=>{
  const r=replay({edit:(kind,data)=>kind==='detail'?change(data):data})
  await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}))
 })
}

test('Domino refuses truncated or newly paginated native inventories',async()=>{
 for(const change of [d=>({...d,meta:{total:23}}),d=>({...d,hasMore:true})]){
  const r=replay({edit:(kind,data)=>kind==='listing'?change(data):data})
  await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}));assert.equal(r.reads.some(r=>r.url===DETAIL),false)
 }
})

test('Domino preserves closing inventory changes as partial and forbids cleanup',async()=>{
 const r=replay({edit:(kind,data)=>{if(kind==='closing'){data.jobs=data.jobs.slice(1);data.meta.total=data.jobs.length}return data}})
 const jobs=await source.run({fetchImpl:r.fetchImpl,now});assert.equal(jobs.length,1)
 assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const value of [null,'not-a-date','2027-01-01T00:00:00Z'])test('Domino does not replace missing/invalid/future publication with an observation: '+value,async()=>{
 const r=replay({edit:(kind,data)=>{if(['listing','closing'].includes(kind))data.jobs.find(j=>j.id===8103605).first_published=value;if(kind==='detail')data.first_published=value;return data}})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}))
})

test('Domino stops further reads after public403and does not use cached binding as fallback',async()=>{
 const r=replay({statusFor:()=>403});await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}));assert.equal(r.reads.length,1)
})

test('Domino rejects changed native portal identity instead of guessing a board',async()=>{
 const r=replay({edit:(kind,data)=>{if(kind==='portal')data.employerProfile.name='A Different Company';return data}})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}));assert.equal(r.reads.length,2)
})

test('Domino never executes scripts returned on the official careers page',async()=>{
 const r=replay({editHome:html=>html+'<script>globalThis.DOMINO_REMOTE_EXECUTED=true</script>'})
 const jobs=await source.run({fetchImpl:r.fetchImpl,now});assert.equal(jobs.length,1);assert.equal(globalThis.DOMINO_REMOTE_EXECUTED,undefined)
})

test('Domino rejects partial maxJobs before requesting native resources',async()=>{
 const r=replay();await assert.rejects(source.run({fetchImpl:r.fetchImpl,now,maxJobs:1}));assert.equal(r.reads.length,0)
})

test('Domino does not infer a current ATS board from an empty portal with no per-role ATS configuration',async()=>{
 const r=replay({edit:(kind,data)=>{if(kind==='portal')data.jobs=[];return data}})
 await assert.rejects(source.run({fetchImpl:r.fetchImpl,now}));assert.equal(r.reads.length,2)
})
