import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url))))
async function replay(change,options={}){
 const f=fixture(),original=globalThis.fetch;let requests=0
 globalThis.fetch=async(url,init={})=>{
  const packet=f.packets.find(p=>p.url===String(url));assert.ok(packet,'Uncaptured request '+url)
  const p=structuredClone(packet);requests++;assert.equal(init.method??'GET',p.method)
  if(p.method==='POST')assert.deepEqual(JSON.parse(init.body),JSON.parse(p.requestBody))
  change?.(p,requests)
  const response=new Response(p.body,{status:p.status});Object.defineProperty(response,'url',{value:p.finalURL});return response
 }
 try{return{jobs:await run({now:'2026-10-21T14:00:00.000Z',requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0,...options}),requests}}finally{globalThis.fetch=original}
}
test('actual official and native four India roles replace the sentinel without inventing whole-company completeness',async()=>{
 const{jobs}=await replay();assert.equal(jobs.length,4)
 assert.equal(jobs.find(j=>j.jobId==='R49865').nativeEmployer,'083 C.H. Robinson Worldwide GmbH')
 assert.ok(jobs.every(j=>j.source==='chrobinson'&&j.company==='C.H. Robinson'&&j.country==='India'&&j.sourceDetailComplete===true&&j.sourceListingComplete===false&&j.sourceScopeComplete===false))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.find(j=>j.jobId==='R49158').postedAt,'2026-09-29T00:00:00.000Z')
})
for(const [name,mutation]of[
 ['corporate inert',p=>{if(p.url.includes('www.chrobinson'))p.body='<div inert>'+p.body+'</div>'}],
 ['corporate hidden',p=>{if(p.url.includes('www.chrobinson'))p.body='<div hidden>'+p.body+'</div>'}],
 ['wrong tenant handoff',p=>{if(p.url.includes('www.chrobinson'))p.body=p.body.replaceAll('chrobinson.wd5','other.wd5')}],
 ['native error envelope',p=>{if(p.url.includes('/wday/cxs/')){const d=JSON.parse(p.body);d.meta={ERROR:'failed'};p.body=JSON.stringify(d)}}],
 ['native legal employer',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.hiringOrganization.name='Other Corporation';p.body=JSON.stringify(d)}}],
 ['native typed country',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.country.descriptor='United States';p.body=JSON.stringify(d)}}],
 ['native structured country',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US';p.body=JSON.stringify(d)}}],
 ['native application identity',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.externalUrl=d.jobPostingInfo.externalUrl.replace('R49157','R99999');p.body=JSON.stringify(d)}}],
 ['native future date',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.startDate='2099-01-01';p.body=JSON.stringify(d)}}],
 ['native inert JD',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription='<div inert>'+d.jobPostingInfo.jobDescription+'</div>';p.body=JSON.stringify(d)}}],
 ...['This job is no longer available.','Click Apply Now to view the full job description.'].map(notice=>[notice,p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription='<p>'+notice+'</p>';p.body=JSON.stringify(d)}}]),
 ['native listing total drift',p=>{if(p.url.endsWith('/jobs')){const d=JSON.parse(p.body);d.total=5;p.body=JSON.stringify(d)}}]
])test('ordinary runtime rejects '+name,async()=>{await assert.rejects(()=>replay(mutation))})
test('caps, explicit zero deadlines, caller abort and HTTP202 do not return empty success',async()=>{
 await assert.rejects(()=>run({maxJobs:0}));await assert.rejects(()=>run({timeoutMs:0}))
 const c=new AbortController();c.abort(Error('cancelled'));await assert.rejects(()=>run({signal:c.signal}),/cancelled/)
 await assert.rejects(()=>replay(p=>{if(p.url.includes('www.chrobinson'))p.status=202}))
})
test('real native description with trailing Apply instruction remains substantive',async()=>{const{jobs}=await replay(p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription+='<p>Click Apply Now to view the full job description.</p>';p.body=JSON.stringify(d)}});assert.equal(jobs.length,4)})
test('final page drift and final-response cancellation cannot retain preceding healthy jobs',async()=>{
 let pages=0;await assert.rejects(()=>replay(p=>{if(p.url.endsWith('/jobs')&&++pages===2){const d=JSON.parse(p.body);d.jobPostings[0].title='Changed title';p.body=JSON.stringify(d)}}))
 const c=new AbortController();await assert.rejects(()=>replay((p,n)=>{if(n===12)c.abort(Error('final response cancelled'))},{signal:c.signal}),/cancelled/)
})
test('corporate handoff timeout bounds an uncooperative injected transport',async()=>{await assert.rejects(()=>run({timeoutMs:25,fetchPage:()=>new Promise(()=>{})}),/timeout|aborted/i)})
for(const notice of [
 'This role is no longer available. This opportunity has closed and the employer is currently unable to accept applications. Please visit the corporate careers website to explore other current vacancies and opportunities.',
 'This position has been filled. We thank all applicants for their interest and invite you to explore the corporate careers website for other available employment opportunities that match your qualifications and experience.',
 'We are no longer accepting applications for this position. Please visit our careers portal to explore other available opportunities and vacancies with our global team, and sign up for updates about future recruitment.'
])test('native explicit closure cannot qualify as substantive JD: '+notice.split('.')[0],async()=>{await assert.rejects(()=>replay(p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription='<p>'+notice+'</p>';p.body=JSON.stringify(d)}}),/closed|unavailable|accepting/i)})
