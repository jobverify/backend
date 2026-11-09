import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime-native-20261021.json.gz',import.meta.url))))
async function replay(change,options={}){
 const f=fixture(),used=new Set(),original=globalThis.fetch
 globalThis.fetch=async(url,init={})=>{
  const i=f.packets.findIndex((p,i)=>p.url===String(url)&&!used.has(i));assert.ok(i>=0,'Uncaptured native request '+url);used.add(i)
  const p=structuredClone(f.packets[i]);assert.equal(init.method??'GET',p.method);assert.equal(init.body??null,p.requestBody);change?.(p)
  const response=new Response(p.body,{status:p.status,headers:{'Content-Type':p.url.includes('/wday/cxs/')?'application/json':'text/html'}})
  Object.defineProperty(response,'url',{value:p.finalURL});return response
 }
 try{return{jobs:await run({now:f.capturedTrial.completedAt,requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0,...options}),used:used.size,f}}finally{globalThis.fetch=original}
}
test('all35 actual native responses produce15 explicit Carelon India roles with partial company scope',async()=>{const {jobs,used}=await replay();assert.equal(used,35);assert.equal(jobs.length,15);assert.ok(jobs.every(j=>j.nativeEmployer==='Carelon Global Solutions India LLP'&&j.source==='carelonglobalsolutions'&&j.country==='India'&&j.sourceDetailComplete===true&&j.sourceListingComplete===false&&j.sourceScopeComplete===false));assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('current native hidden fullJD, changed legal employer and status failure cannot retain earlier healthy jobs',async()=>{for(const change of [p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);j.jobPostingInfo.jobDescription='<div inert>'+j.jobPostingInfo.jobDescription+'</div>';p.body=JSON.stringify(j)}},p=>{if(p.id>=21&&p.url.includes('/job/')){const j=JSON.parse(p.body);j.hiringOrganization.name='Elevance Health Inc.';p.body=JSON.stringify(j)}},p=>{if(p.id>=21&&p.url.includes('/job/')){const j=JSON.parse(p.body);j.meta={ERROR:'failed'};p.body=JSON.stringify(j)}}])await assert.rejects(()=>replay(change))})
test('zero cap, explicit zero timeout and cancelled caller do not yield empty success',async()=>{await assert.rejects(()=>run({maxJobs:0}));await assert.rejects(()=>run({timeoutMs:0}));const c=new AbortController();c.abort(Error('cancelled'));await assert.rejects(()=>run({signal:c.signal}),/cancelled/)})
for(const notice of [
 'This job is no longer available.',
 'Click Apply Now to view the full job description.',
 'The role is no longer available. Please explore our corporate careers website for other current opportunities that match your qualifications and experience.',
 'This position has been filled. We invite interested candidates to visit the careers website for other available opportunities with our organization.',
 'We are no longer accepting applications for this position. Please return to our careers website to explore other roles and future opportunities.',
])test('native notice alone cannot establish a full role: '+notice,async()=>{await assert.rejects(()=>replay(p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);j.jobPostingInfo.jobDescription='<p>'+notice+'</p>';p.body=JSON.stringify(j)}}))})
test('meaningful native JD followed by an application instruction remains full content',async()=>{const {jobs}=await replay(p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);j.jobPostingInfo.jobDescription+='<p>Click Apply Now to view the full job description.</p>';p.body=JSON.stringify(j)}});assert.equal(jobs.length,15);assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.jobDescription.length>1000))})
