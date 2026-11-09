import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-browser-20261021.json.gz',import.meta.url))))
async function replay(change,options={}){
 const f=fixture(),original=globalThis.fetch;let requests=0
 globalThis.fetch=async(url,init={})=>{
  const packet=f.packets.find(p=>p.url===String(url));assert.ok(packet,'Uncaptured request '+url)
  const p=structuredClone(packet);requests++;assert.equal(init.method??'GET',p.method)
  if(p.method==='POST')assert.deepEqual(JSON.parse(init.body),JSON.parse(p.requestBody))
  change?.(p,requests)
  const response=new Response(p.body,{status:p.status});Object.defineProperty(response,'url',{value:p.finalURL});return response
 }
 try{return{jobs:await run({now:'2026-10-21T15:24:09.832Z',requestScheduler:{acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0},retryBaseDelayMs:0,...options}),requests}}finally{globalThis.fetch=original}
}
test('actual official and native fourteen Bangalore India roles replace the sentinel without inventing whole-company completeness',async()=>{
 const{jobs,requests}=await replay();assert.equal(jobs.length,14);assert.equal(requests,32)
 assert.equal(jobs.find(j=>j.jobId==='JR37232').nativeEmployer,'Allegion India Private Limited')
 assert.ok(jobs.every(j=>j.source==='allegion'&&j.company==='Allegion'&&j.country==='India'&&j.sourceDetailComplete===true&&j.sourceListingComplete===false&&j.sourceScopeComplete===false))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.find(j=>j.jobId==='JR37232').postedAt,'2026-10-15T00:00:00.000Z')
})
for(const label of ['US - Chicago','Singapore Office','United States - Remote'])test('typed India cannot hide explicit foreign office '+label,async()=>{
 await assert.rejects(()=>replay(p=>{if(p.url.includes('/wday/cxs/')&&p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.location=label;d.jobPostingInfo.jobRequisitionLocation.descriptor=label;p.body=JSON.stringify(d)}}))
})
for(const label of ['IT Park, Bangalore, India','No. 2, IT Park, Bangalore, India'])test('explicit India office control remains valid: '+label,async()=>{
 const{jobs}=await replay(p=>{if(p.url.includes('/wday/cxs/')&&p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.location=label;d.jobPostingInfo.jobRequisitionLocation.descriptor=label;p.body=JSON.stringify(d)}});assert.equal(jobs.length,14)
})
test('duplicate regional listing IDs cannot establish a complete regional inventory',async()=>{
 await assert.rejects(()=>replay(p=>{if(p.url.endsWith('/jobs')){const d=JSON.parse(p.body);d.jobPostings[1]=d.jobPostings[0];p.body=JSON.stringify(d)}}))
})
const companyOnly='<h2>Creating Peace of Mind by Pioneering Safety and Security</h2><p>At Allegion, we help keep the people you know and love safe and secure where they live, work and visit. With more than 40 brands, 14,000 employees globally and products sold in 130 countries, we specialize in security around the doorway and beyond.</p>'
for(const description of [companyOnly,'<p>Click Apply Now to view the full job description.</p>'+companyOnly])test('company promotion is retained as a rejected native row, not a full job description: '+description.slice(0,35),async()=>{
 const{jobs}=await replay(p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);if(d.jobPostingInfo.jobReqId==='JR37232')d.jobPostingInfo.jobDescription=description;p.body=JSON.stringify(d)}})
 assert.equal(jobs.length,14);const row=jobs.find(j=>j.jobId==='JR37232');assert.equal(row.sourceDetailComplete,false);assert.equal(row.jobDescription,null);assert.equal(row.sourceDescription,null)
 assert.equal(row.sourceDetailFailureKind,'unqualified-role-content');assert.equal(row.sourceRejectedNativeDescription,description)
 // Missing content remains eligible for later enrichment under the publishing
 // policy; it must still never become a complete native role description.
 const a=analyzePublishableJobs(jobs,{now:'2026-10-21T15:24:09.832Z'});assert.equal(a.eligibleJobs.length,12);assert.equal(a.filterCounts.emptyDescription,0);assert.equal(a.indiaJobs.length,14)
 assert.deepEqual(a.filterCounts,{nonIndia:0,old:2,closed:0,invalidUrl:0,nonJob:0,emptyDescription:0})
 assert.equal(a.eligibleJobs.find(job=>job.jobId==='JR37232').sourceDetailComplete,false)
})
for(const[name,change]of[
 ['duplicate posting UID',(d)=>{d.jobPostingInfo.id='686e59a8dd4f1001938c90fdb0120000'}],
 ['single final UID drift',(d,n)=>{if(n>18&&d.jobPostingInfo.jobReqId==='JR37232')d.jobPostingInfo.id='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}],
 ['selected Bangalore contradicts Mumbai',(d)=>{d.jobPostingInfo.location='Mumbai, India';d.jobPostingInfo.jobRequisitionLocation.descriptor='Mumbai, India'}]
])test('native guarded pass rejects '+name,async()=>{await assert.rejects(()=>replay((p,n)=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);change(d,n);p.body=JSON.stringify(d)}}))})
test('current selected location facet descriptor must corroborate its configured native ID',async()=>{
 await assert.rejects(()=>replay(p=>{if(p.url.endsWith('/jobs')){const d=JSON.parse(p.body);const walk=value=>{if(!value||typeof value!=='object')return;if(value.id==='bcf71f1c5971014066533f84bf001941')value.descriptor='Mumbai, India';Object.values(value).forEach(walk)};walk(d.facets);p.body=JSON.stringify(d)}}))
})
test('synthetic two-page expansion of actual native shapes enumerates and rechecks every page and UID',async()=>{
 const f=fixture(),original=globalThis.fetch,template=JSON.parse(f.packets.find(p=>p.url.endsWith('/jobs')).body),native=JSON.parse(f.packets.find(p=>p.url.includes('/job/')).body)
 const rows=Array.from({length:21},(_,i)=>({...template.jobPostings[0],title:'Synthetic pagination role '+i,externalPath:'/job/Bangalore-India/Synthetic_JR'+(90000+i),bulletFields:['JR'+(90000+i)]}))
 const offsets=[],seen=new Map()
 globalThis.fetch=async(url,init={})=>{
  let packet
  if(String(url).endsWith('/jobs')){const b=JSON.parse(init.body);assert.deepEqual(b.appliedFacets,{locations:['bcf71f1c5971014066533f84bf001941']});offsets.push(b.offset);const d=structuredClone(template);d.total=21;d.jobPostings=rows.slice(b.offset,b.offset+20);const walk=v=>{if(!v||typeof v!=='object')return;if(v.id==='bcf71f1c5971014066533f84bf001941'||v.id==='c4f78be1a8f14da0ab49ce1162348a5e')v.count=21;Object.values(v).forEach(walk)};walk(d.facets);packet={body:JSON.stringify(d),status:200,finalURL:String(url)}}
  else if(String(url).includes('/job/')){const row=rows.find(r=>String(url).endsWith(r.externalPath));assert.ok(row);const d=structuredClone(native),i=rows.indexOf(row);Object.assign(d.jobPostingInfo,{id:(i+1).toString(16).padStart(32,'0'),title:row.title,jobReqId:row.bulletFields[0],jobPostingId:row.externalPath.split('/').at(-1),externalUrl:'https://allegion.wd5.myworkdayjobs.com/careers'+row.externalPath});seen.set(i,(seen.get(i)||0)+1);packet={body:JSON.stringify(d),status:200,finalURL:String(url)}}
  else packet=f.packets.find(p=>p.url===String(url))
  assert.ok(packet);const r=new Response(packet.body,{status:packet.status});Object.defineProperty(r,'url',{value:packet.finalURL});return r
 }
 try{const jobs=await run({now:f.observedAt});assert.equal(jobs.length,21);assert.deepEqual(offsets,[0,20,0,20]);assert.equal(seen.size,21);assert.ok([...seen.values()].every(n=>n===2));assert.ok(jobs.every(j=>j.sourceListingComplete===false))}finally{globalThis.fetch=original}
})
for(const [name,mutation]of[
 ['corporate inert',p=>{if(p.url.includes('www.allegion'))p.body='<div inert>'+p.body+'</div>'}],
 ['corporate hidden',p=>{if(p.url.includes('www.allegion'))p.body='<div hidden>'+p.body+'</div>'}],
 ['wrong tenant handoff',p=>{if(p.url.includes('www.allegion'))p.body=p.body.replaceAll('allegion.wd5','other.wd5')}],
 ['native error envelope',p=>{if(p.url.includes('/wday/cxs/')){const d=JSON.parse(p.body);d.meta={ERROR:'failed'};p.body=JSON.stringify(d)}}],
 ['native legal employer',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.hiringOrganization.name='Other Corporation';p.body=JSON.stringify(d)}}],
 ['native typed country',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.country.descriptor='United States';p.body=JSON.stringify(d)}}],
 ['native structured country',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US';p.body=JSON.stringify(d)}}],
 ['native application identity',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.externalUrl=d.jobPostingInfo.externalUrl.replace(/JR\d+$/, 'JR99999');p.body=JSON.stringify(d)}}],
 ['native future date',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.startDate='2099-01-01';p.body=JSON.stringify(d)}}],
 ['native inert JD',p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription='<div inert>'+d.jobPostingInfo.jobDescription+'</div>';p.body=JSON.stringify(d)}}],
 ...['This job is no longer available.','Click Apply Now to view the full job description.'].map(notice=>[notice,p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription='<p>'+notice+'</p>';p.body=JSON.stringify(d)}}]),
 ['native listing total drift',p=>{if(p.url.endsWith('/jobs')){const d=JSON.parse(p.body);d.total=15;p.body=JSON.stringify(d)}}]
])test('ordinary runtime rejects '+name,async()=>{await assert.rejects(()=>replay(mutation))})
test('caps, explicit zero deadlines, caller abort and HTTP202 do not return empty success',async()=>{
 await assert.rejects(()=>run({maxJobs:0}));await assert.rejects(()=>run({timeoutMs:0}))
 const c=new AbortController();c.abort(Error('cancelled'));await assert.rejects(()=>run({signal:c.signal}),/cancelled/)
 await assert.rejects(()=>replay(p=>{if(p.url.includes('www.allegion'))p.status=202}))
})
test('real native description with trailing Apply instruction remains substantive',async()=>{const{jobs}=await replay(p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription+='<p>Click Apply Now to view the full job description.</p>';p.body=JSON.stringify(d)}});assert.equal(jobs.length,14)})
test('final page drift and final-response cancellation cannot retain preceding healthy jobs',async()=>{
 let pages=0;await assert.rejects(()=>replay(p=>{if(p.url.endsWith('/jobs')&&++pages===2){const d=JSON.parse(p.body);d.jobPostings[0].title='Changed title';p.body=JSON.stringify(d)}}))
 const c=new AbortController();await assert.rejects(()=>replay((p,n)=>{if(n===32)c.abort(Error('final response cancelled'))},{signal:c.signal}),/cancelled/)
})
test('corporate handoff timeout bounds an uncooperative injected transport',async()=>{await assert.rejects(()=>run({timeoutMs:25,fetchPage:()=>new Promise(()=>{})}),/timeout|aborted/i)})
for(const notice of [
 'This role is no longer available. This opportunity has closed and the employer is currently unable to accept applications. Please visit the corporate careers website to explore other current vacancies and opportunities.',
 'This position has been filled. We thank all applicants for their interest and invite you to explore the corporate careers website for other available employment opportunities that match your qualifications and experience.',
 'We are no longer accepting applications for this position. Please visit our careers portal to explore other available opportunities and vacancies with our global team, and sign up for updates about future recruitment.'
])test('native explicit closure cannot qualify as substantive JD: '+notice.split('.')[0],async()=>{await assert.rejects(()=>replay(p=>{if(p.url.includes('/job/')){const d=JSON.parse(p.body);d.jobPostingInfo.jobDescription='<p>'+notice+'</p>';p.body=JSON.stringify(d)}}),/closed|unavailable|accepting/i)})
