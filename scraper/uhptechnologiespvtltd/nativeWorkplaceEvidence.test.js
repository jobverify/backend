import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
for(const row of packet.requests)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.bodySHA256)
const read=async url=>{const row=packet.requests.find(x=>x.url===String(url));assert.ok(row,'Unadvertised/unrecorded URL '+url);return row.body}
const options={fetchText:read,fetchJson:async url=>JSON.parse(await read(url)),now:()=> '2026-10-31T09:00:00.000Z'}
test('current native role location IDs resolve through typed employer location lookup without guessed countries',async()=>{const jobs=await source.run(options);assert.equal(jobs.length,22);const j=jobs.find(j=>j.title==='Technical Recruiter');assert.equal(j.location,'Bangalore');assert.equal(j.country,null);assert.deepEqual(j.rawNativeLocationEvidence.locationIds,['4']);assert.equal(j.rawNativeLocationEvidence.locations[0].categoryId,'1');assert.ok(jobs.filter(j=>j.country==null).length>10)})
test('registered decorator retains compact truthful native collection evidence',async()=>{const provider=getScraperCatalog().find(p=>p.source==='uhptechnologiespvtltd'),jobs=await createCatalogScraper(provider).run(options);const evidence=jobs[0]?.nativeCollectionEvidence;assert.ok(evidence);assert.equal(evidence.source,'uhptechnologiespvtltd');assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})

test('typed lookup applies to another valid native role and refuses category/country/date conflicts',async()=>{
 const payload=JSON.parse(await read(source.JOBS_API_URL)),lookup=JSON.parse(await read(source.LOCATION_LOOKUP_URL)),original=payload.data.find(j=>j.title==='Technical Recruiter'),role={...original,id:'another-native-role',title:'Another Recruiter',locations:['4'],description:'<p>Job Location: Bangalore</p><p>Recruit technical staff and coordinate interviews for engineering teams.</p>'}
 assert.equal(source.mapNativeUhpJob(role,lookup).location,'Bangalore');assert.equal(source.mapNativeUhpJob(role,lookup).country,null)
 assert.throws(()=>source.mapNativeUhpJob({...role,locations:['26']},lookup),/wrong-category/)
 assert.throws(()=>source.mapNativeUhpJob({...role,locations:['4','4']},lookup),/duplicate/)
 const foreign=structuredClone(lookup);foreign.value['4'].name='Bangalore, Canada';assert.throws(()=>source.mapNativeUhpJob({...role,description:'<p>Job Location: Bangalore, India</p>'},foreign),/country.*contradict/i)
 assert.throws(()=>source.mapNativeUhpJob({...role,published_on_career_page:'2026-02-30T10:00:00Z'},lookup),/date|timestamp/i)
})

test('default public transport rejects access denial and off-origin redirects, cancels unread bodies, and honors pre-cancellation',async()=>{
 const publicFetch=globalThis.fetch;let calls=0,cancelled=0
 try{
  globalThis.fetch=async()=>{calls++;return {ok:false,status:403,url:'https://denied.example/',body:{cancel:async()=>{cancelled++}}}}
  await assert.rejects(source.run(),error=>error.status===403&&error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null&&error.inventoryEvidence?.indiaFacetCount===null)
  assert.equal(calls,1);assert.equal(cancelled,1)
  globalThis.fetch=async()=>{calls++;return {ok:true,status:200,url:'https://other.example/careers',body:{cancel:async()=>{cancelled++}}}}
  await assert.rejects(source.run(),/unexpected native redirect/);assert.equal(calls,2);assert.equal(cancelled,2)
  const controller=new AbortController(),reason=new Error('cancelled before native request');controller.abort(reason)
  await assert.rejects(source.run({signal:controller.signal}),error=>error===reason);assert.equal(calls,2)
 }finally{globalThis.fetch=publicFetch}
})

test('HTTP200 access denial is unavailable with unknown inventory rather than a successful empty result or retryable parser drift',async()=>{const publicFetch=globalThis.fetch;let calls=0;try{globalThis.fetch=async url=>{calls++;return {ok:true,status:200,url:String(url),text:async()=>'<html><title>Access Denied</title><body>Access to this resource is denied.</body></html>'}};await assert.rejects(source.run(),error=>error.code==='access_denied'&&error.abortRetries===true&&error.inventoryEvidence?.reportedTotal===null);assert.equal(calls,1)}finally{globalThis.fetch=publicFetch}})

test('captured mandatory worksite residence is explicit country scope with an unknown city',async()=>{const jobs=await source.run(options),job=jobs.find(j=>j.title==='Instrumentation Engineer/ Sr. Engineer/ AM/ Manager : Project Sites');assert.equal(job.location,'India');assert.equal(job.country,'India');assert.equal(job.city,null);assert.equal(job.rawNativeLocationEvidence.mandatoryWorksiteResidence.statement,'Candidate must stay at customer location anywhere in India.');assert.equal(job.rawNativeLocationEvidence.mandatoryWorksiteResidence.qualified,true)})
test('controlled another-role mandatory-residence example uses the same general native semantics',async()=>{const payload=JSON.parse(await read(source.JOBS_API_URL)),original=payload.data.find(j=>j.title==='Technical Recruiter'),role={...original,id:'controlled-other-role',req_id:'controlled-req',title:'Controlled Field Engineer',slug:'controlled-field-engineer',apply_url:'https://uhptechnologies.greythr.com/hire/jobs/controlled-field-engineer',locations:null,description:'<p>Job Description</p><p>Candidate must stay at customer location anywhere in India.</p><p>Install and maintain production controls and document commissioning results.</p>'},job=source.mapNativeUhpJob(role,null);assert.equal(job.location,'India');assert.equal(job.country,'India');assert.equal(job.city,null);assert.equal(job.rawNativeLocationEvidence.mandatoryWorksiteResidence.qualified,true)})
test('travel, conditional stay, foreign and corporate/example/hidden prose cannot qualify mandatory worksite residence',async()=>{const payload=JSON.parse(await read(source.JOBS_API_URL)),original=payload.data.find(j=>j.title==='Technical Recruiter'),base={...original,locations:null};for(const description of ['<p>Candidate must travel to customer locations anywhere in India.</p>','<p>Candidate may stay at customer location anywhere in India.</p>','<p>If needed, candidate must stay at customer location anywhere in India.</p>','<p>Candidate must stay at customer location anywhere in Canada.</p>','<p>Company example: Candidate must stay at customer location anywhere in India.</p>','<h3>About the company</h3><p>Candidate must stay at customer location anywhere in India.</p>','<blockquote><p>Candidate must stay at customer location anywhere in India.</p></blockquote>','<p hidden>Candidate must stay at customer location anywhere in India.</p>','<p style="display:none">Candidate must stay at customer location anywhere in India.</p>','<p>We serve clients anywhere in India.</p>']){const job=source.mapNativeUhpJob({...base,description},null);assert.equal(job.location,null,description);assert.equal(job.country,null,description)}})
test('mandatory residence cannot erase a supplied country or unresolved native workplace statement',async()=>{const payload=JSON.parse(await read(source.JOBS_API_URL)),original=payload.data.find(j=>j.title==='Technical Recruiter'),statement='<p>Candidate must stay at customer location anywhere in India.</p>',base={...original,locations:null,description:statement};assert.throws(()=>source.mapNativeUhpJob({...base,country:'Canada'},null),/country.*contradict/i);assert.throws(()=>source.mapNativeUhpJob({...base,description:'<p>Job Location: Toronto, Canada</p>'+statement},null),/country.*contradict/i);const role=source.mapNativeUhpJob({...base,description:'<p>Job Location: Toronto</p>'+statement},null);assert.equal(role.location,'Toronto');assert.equal(role.country,null);assert.equal(role.rawNativeLocationEvidence.mandatoryWorksiteResidence.qualified,false);assert.throws(()=>source.mapNativeUhpJob({...base,description:statement+'<p>Candidate must stay at customer location anywhere in Canada.</p>'},null),/country.*contradict/i)})
