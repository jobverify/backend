import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js'
import {filterIndiaJobs} from '../scraper-support/utils/indiaLocationFilter.js'
import {getValidIndiaCityForJob} from '../src/utils/publicJobLocationScope.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/first-party-native-criteria-quality.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex'),capture=source=>fixture.sources.find(s=>s.source===source)
const key=(url,options={})=>(options.method||'GET')+':'+url+':'+(options.body||'')
function transport(source,mutate=()=>{}){
 const pending=new Map(),calls=[],seen=new Map()
 for(const packet of capture(source).requests){const id=key(packet.requestedURL,{method:packet.method,body:packet.body});const list=pending.get(id)||[];list.push(structuredClone(packet));pending.set(id,list)}
 return {calls,get remaining(){return [...pending.values()].reduce((n,list)=>n+list.length,0)},async fetch(url,options={}){
  const id=key(String(url),options),list=pending.get(id);assert.ok(list?.length,'Uncaptured public request '+id)
  const packet=list.shift(),occurrence=(seen.get(id)||0)+1;seen.set(id,occurrence)
  mutate(packet,occurrence);calls.push({url:String(url),options,packet,occurrence})
  const response=new Response(packet.text,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }}
}
async function replay(source,mutate,options={}){
 const read=transport(source,mutate),prior=globalThis.fetch,provider=getScraperCatalog().find(p=>p.source===source)
 globalThis.fetch=()=>{throw Error('Unexpected live public request')}
 try{return {jobs:await createCatalogScraper(provider).run({fetchImpl:(...args)=>read.fetch(...args),requestIntervalMs:0,now:()=>capture(source).completedAt,...options}),read,provider}}
 finally{globalThis.fetch=prior}
}
const observations=jobs=>jobs[Symbol.for('jobverify.verified-recruitment-observations')]
function rewriteFlightText(html,rewrite){
 return html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(original,attrs,body)=>{
  const match=/^\s*self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?\s*$/.exec(body)
  if(!match)return original
  const value=JSON.parse(match[1]);if(value[0]!==1||typeof value[1]!=='string')return original
  value[1]=rewrite(value[1]);return '<script'+attrs+'>self.__next_f.push('+JSON.stringify(value)+')</script>'
 })
}
test('the current first-party fixture retains all 66 original response bodies and production pacing',()=>{
 assert.equal(fixture.sources.reduce((n,s)=>n+s.requests.length,0),66)
 for(const s of fixture.sources){const prior=new Map();for(const p of s.requests){
  assert.equal(p.replayed,false);assert.equal(p.status,200);assert.equal(p.method,'GET')
  assert.equal(sha(p.text),p.bodySHA256);assert.equal(Buffer.byteLength(p.text),p.bodyBytes)
  const origin=new URL(p.requestedURL).origin,start=Date.parse(p.startedAt)
  if(prior.has(origin))assert.ok(start-prior.get(origin)>=850,'Unpaced current public read')
  prior.set(origin,start)
 }}
})
for(const[source,count]of[['webandcrafts',26],['frugaltesting',3]]){
 test(source+' registered route retains every full original native role and closing context',async()=>{
  const {jobs,read}=await replay(source)
  assert.equal(jobs.length,count);assert.equal(read.remaining,0);assert.deepEqual(jobs.map(j=>j.jobId),capture(source).expected.ids)
  assert.equal(observations(jobs).closedNativeDetails,count);assert.deepEqual(observations(jobs).failures,[])
  for(const j of jobs){const expected=capture(source).expected.roles.find(r=>r.id===j.jobId)
   assert.equal(sha(j.jobDescription),expected.descriptionSHA256);assert.equal(sha(JSON.stringify(j.nativeSourceRecord)),expected.nativeRecordSHA256)
   assert.ok(j.jobDescription.length>1000);assert.equal(j.sourceDescription,j.jobDescription);assert.equal(j.sourceDetailComplete,true)
   assert.equal(j.sourceClosingQualified,true);assert.equal(j.country,null);assert.equal(j.location,null);assert.equal(j.city,null);assert.equal(j.state,null)
   assert.equal(j.sourceCountryScopeUnresolved,true);assert.ok(j.nativeWorkplace);assert.equal(j.nativeLegalEmployer,null)
   assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.sourceScopeComplete,false);assert.equal(j.sourceListingComplete,false)
   assert.equal(j.lifecycleCleanupAllowed,false);assert.equal(j.applicationVisited,false)
  }
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 })
 test(source+' unknown worksite countries survive normalization and cannot enter India filters',async()=>{
  const {jobs,provider}=await replay(source),normalized=jobs.map(j=>normalizeScrapedJob(j,provider))
  for(const j of normalized){assert.equal(j.country,null);assert.equal(getValidIndiaCityForJob(j),null)}
  assert.equal(filterIndiaJobs(jobs).length,0);assert.equal(filterIndiaJobs(normalized).length,0)
 })
 test(source+' zero cap and cancellation settle without public reads',async()=>{
  const empty=await replay(source,undefined,{maxJobs:0});assert.equal(empty.jobs.length,0);assert.equal(empty.read.calls.length,0)
  const controller=new AbortController();controller.abort(Error('caller cancelled'))
  await assert.rejects(replay(source,undefined,{signal:controller.signal}),/caller cancelled/)
 })
 test(source+' a first-page denial stops all source reads and cannot certify empty',async()=>{
  const {jobs,read}=await replay(source,p=>{p.status=403;p.text='Access denied'})
  assert.equal(jobs.length,0);assert.equal(read.calls.length,1);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(observations(jobs).sourceScopeComplete,false)
 })
 test(source+' a later detail denial retains earlier observations and stops the source',async()=>{
  const {jobs,read}=await replay(source,(p,n)=>{if(n===1&&p.requestedURL.includes('/'+(source==='webandcrafts'?'marketing-manager?':'senior-qa-engineer'))){p.status=403;p.text='Access denied'}})
  assert.equal(jobs.length,1);assert.equal(jobs[0].sourceClosingQualified,false)
  assert.equal(read.calls.at(-1).packet.status,403);assert.equal(observations(jobs).sourceScopeComplete,false)
 })
 test(source+' an actual closing criteria change cannot qualify unchanged opening content',async()=>{
  const {jobs}=await replay(source,(p,n)=>{if(n===2&&p.requestedURL.includes('/job-openings/')){
   const phrase=source==='webandcrafts'?'Lead and manage the sales team':'Managing organizational sales'
   // Preserve native UTF-8 record lengths so this is a valid changed model,
   // independently of the separate malformed-framing regression.
   p.text=p.text.replaceAll(phrase,'Changed responsibilities'.padEnd(phrase.length,'.'))
  }})
  assert.equal(jobs.length,count);assert.equal(jobs[0].sourceClosingQualified,false)
  assert.match(observations(jobs).failures.map(f=>f.message).join(' '),/closing role changed/)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 })
 test(source+' an India label in unrelated footer content cannot supply a job country',async()=>{
  const {jobs}=await replay(source,p=>{p.text=p.text.replace('</body>','<footer>Office country: India</footer></body>')})
  assert.equal(jobs.length,count);assert.ok(jobs.every(j=>j.country===null&&j.location===null))
 })
}
test('Webandcrafts preserves changing original Flight reference IDs while comparing resolved native contents',async()=>{
 const {jobs}=await replay('webandcrafts')
 const long=jobs.filter(j=>Object.keys(j.nativeFlightTextRecords).length)
 assert.ok(long.length>=10)
 for(const j of long){assert.match(j.jobDescription,/Responsibilities:/);assert.match(j.jobDescription,/Requirements:/);assert.equal(j.sourceClosingQualified,true)}
 const target=long[0],id=Object.keys(target.nativeFlightTextRecords)[0],renamed='fff'+id
 const changed=await replay('webandcrafts',(p,n)=>{if(n===2&&p.requestedURL===target.sourceUrl)p.text=rewriteFlightText(p.text,text=>text
  .replace(new RegExp('(^|\\n)'+id+':T','g'),'$1'+renamed+':T')
  .replace(new RegExp('\\$'+id+'(?![a-f0-9])','g'),'$'+renamed))})
 const current=changed.jobs.find(j=>j.jobId===target.jobId)
 assert.equal(current.sourceClosingQualified,true);assert.notDeepEqual(current.nativeSourceRecord,current.nativeClosingSourceRecord)
 assert.equal(current.jobDescription,target.jobDescription);assert.deepEqual(observations(changed.jobs).failures,[])
 const ui=jobs.find(j=>j.jobId==='WAC-DSGN-UI/-8502');assert.ok(ui)
})
test('Webandcrafts retains creation timestamps without calling them publication dates',async()=>{
 const {jobs}=await replay('webandcrafts')
 for(const j of jobs){assert.equal(j.sourceRawDates.created_at,j.nativeSourceRecord.created_at);assert.equal(j.nativeCreatedAt,j.nativeSourceRecord.created_at);assert.equal(j.postingDate,null);assert.equal(j.sourcePostingDateIsExact,false)}
})
test('Webandcrafts rejects malformed length-framed literal criteria rather than emitting a listing blurb',async()=>{
 const {jobs}=await replay('webandcrafts',p=>{if(p.requestedURL.includes('/marketing-manager?'))p.text=p.text.replace(/:T[a-f0-9]+/,':T1')})
 assert.equal(jobs.length,25);assert.ok(!jobs.some(j=>j.jobId==='WAC-DM-MAR-5169'))
 assert.ok(observations(jobs).failures.length)
})
test('Webandcrafts requires the own native employer declaration even when the global page remains branded',async()=>{
 const {jobs}=await replay('webandcrafts',p=>{if(p.requestedURL.includes('/business-development-manager?'))p.text=p.text.replaceAll('becoming a part of Webandcrafts.','becoming a part of Other Employer.')})
 assert.equal(jobs.length,25);assert.ok(!jobs.some(j=>j.jobId==='WAC-BDE-BUS-8265'))
})
test('Webandcrafts ignores inert Flight-shaped payloads and does not read the legacy department API',async()=>{
 const {jobs,read}=await replay('webandcrafts',p=>{p.text=p.text.replace('</body>','<template><script>self.__next_f.push([1,"fake"])</script></template></body>')})
 assert.equal(jobs.length,26);assert.ok(read.calls.every(c=>c.options.method==='GET'&&new URL(c.url).hostname==='webandcrafts.com'))
})
test('Frugal Testing retains complete current responsibilities and qualifications beyond the introduction',async()=>{
 const {jobs}=await replay('frugaltesting')
 const sales=jobs.find(j=>j.jobId==='sales-executive')
 assert.match(sales.jobDescription,/Meeting planned sales goals/);assert.match(sales.jobDescription,/Qualifications/)
 assert.match(sales.jobDescription,/Managing organizational sales/)
 assert.equal(sales.employmentType,'Full Time, Permanent');assert.equal(sales.experienceRequired,'2 to 5 years')
 for(const j of jobs){assert.equal(sha(j.sourceRawNativeHTML),j.sourceRawNativeHTMLSHA256);assert.equal(j.nativeSourceRecord.descriptionSections.length,2)}
})
test('Frugal Testing cannot replace missing full responsibilities with its introductory blurb',async()=>{
 const {jobs}=await replay('frugaltesting',p=>{if(p.requestedURL.includes('/sales-executive'))p.text=p.text.replaceAll('Roles and Responsibilities','Unrelated heading')})
 assert.equal(jobs.length,2);assert.ok(!jobs.some(j=>j.jobId==='sales-executive'))
})
