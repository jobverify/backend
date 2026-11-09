import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz',import.meta.url))))
for (const employer of ['Ciena (Asia) Limited, Philippine Branch', 'Ciena Communications, Inc.']) {
 test('native India roles preserve current Ciena legal employer: ' + employer, async t => {
  const { jobs } = await replay(t, packet => {
   if (packet.url.includes('/job/')) { const value = JSON.parse(packet.body); value.hiringOrganization.name = employer; packet.body = JSON.stringify(value) }
  })
  assert.equal(jobs.length, 8)
  assert.ok(jobs.every(job => job.nativeEmployer === employer))
 })
}
async function replay(t,change,options={}){
 const {packets,capturedTrial}=fixture(),counts={posts:0,details:0},calls=[],used=new Set()
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  const index=packets.findIndex((p,i)=>!used.has(i)&&p.url===String(url)&&p.method===(init.method??'GET')&&(p.method!=='POST'||p.requestBody===(init.body??null)))
  const p=index<0?null:structuredClone(packets[index]);used.add(index)
  assert.ok(p,'Unexpected request '+url);calls.push(String(url));if(p.method==='POST')counts.posts++;if(p.url.includes('/job/'))counts.details++
  change?.(p,counts)
  const r=new Response(p.body,{status:p.status});Object.defineProperty(r,'url',{value:p.finalURL});return r
 })
 return{jobs:await run({now:()=> capturedTrial.completedAt,requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0,...options}),counts,calls}
}
test('all19 actual responses replace the sentinel with eight native India roles, original dates and legal employers',async t=>{
 const {jobs,counts,calls}=await replay(t);assert.equal(jobs.length,8);assert.equal(calls.length,19);assert.equal(counts.posts,2);assert.equal(counts.details,16)
 const details=fixture().packets.filter(p=>p.url.includes('/job/')).map(p=>JSON.parse(p.body))
 for(const job of jobs){const p=details.find(p=>p.jobPostingInfo.jobReqId===job.jobId);assert.ok(p);assert.equal(job.source,'ciena');assert.equal(job.country,'India');assert.equal(job.nativeEmployer,p.hiringOrganization.name);assert.equal(job.sourceDescription,p.jobPostingInfo.jobDescription);assert.equal(job.postedAt,p.jobPostingInfo.startDate+'T00:00:00.000Z');assert.equal(job.sourceUrl,p.jobPostingInfo.externalUrl);assert.equal(job.sourceListingComplete,false)}
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const [name,mutate]of [
 ['wrong employer',j=>{j.hiringOrganization.name='Unrelated Networks Ltd'}],
 ['foreign native country',j=>{j.jobPostingInfo.country.descriptor='United States of America'}],
 ['missing description',j=>{j.jobPostingInfo.jobDescription=''}],
 ['inert full description',j=>{j.jobPostingInfo.jobDescription='<div inert>'+j.jobPostingInfo.jobDescription+'</div>'}],
 ['unavailable notice',j=>{j.jobPostingInfo.jobDescription='<p>This job is no longer available.</p>'}],
 ...[
  'The role is no longer available. Please explore our corporate careers website for other current opportunities that match your qualifications and experience.',
  'This position has been filled. We invite interested candidates to visit the careers website for other available opportunities with our organization.',
  'We are no longer accepting applications for this position. Please return to our careers website to explore other roles and future opportunities.',
 ].map(notice=>[notice,j=>{j.jobPostingInfo.jobDescription='<p>'+notice+'</p>'}]),
 ['instruction-only content',j=>{j.jobPostingInfo.jobDescription='<p>Click Apply Now to view the full job description.</p>'}],
 ['future native posting',j=>{j.jobPostingInfo.startDate='2099-01-01'}]
])test(name+' cannot yield publishable jobs',async t=>{
 await assert.rejects(()=>replay(t,p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);mutate(j);p.body=JSON.stringify(j)}}))
})
test('native final listing drift cannot inherit a previous count',async t=>{await assert.rejects(()=>replay(t,(p,c)=>{if(p.method==='POST'&&c.posts>1){const j=JSON.parse(p.body);j.jobPostings[0].title+=' changed';p.body=JSON.stringify(j)}}))})
test('upstream403 cannot become an empty successful scrape',async t=>{await assert.rejects(()=>replay(t,p=>{p.status=403}),/403/)})
test('a native failure envelope cannot certify an inventory',async t=>{await assert.rejects(()=>replay(t,p=>{if(p.method==='POST'){const j=JSON.parse(p.body);j.meta={ERROR:'unavailable'};p.body=JSON.stringify(j)}}))})
test('explicit empty checked India facet remains a partial company check',async t=>{const{jobs}=await replay(t,p=>{if(p.method==='POST')p.body=JSON.stringify({total:0,jobPostings:[],facets:[]})});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('a caller cap cannot turn an unfinished check into empty success',async()=>{await assert.rejects(()=>run({maxJobs:0}))})
test('cancelled caller and zero timeout fail before yielding jobs',async()=>{await assert.rejects(()=>run({timeoutMs:0}));await assert.rejects(()=>run({signal:AbortSignal.abort(Error('cancelled'))}),/cancelled/)})
test('a complete native description followed by application instructions remains valid',async t=>{const{jobs}=await replay(t,p=>{if(p.url.includes('/job/')){const j=JSON.parse(p.body);j.jobPostingInfo.jobDescription+='<p>Click Apply Now to view the full job description.</p>';p.body=JSON.stringify(j)}});assert.equal(jobs.length,8)})
