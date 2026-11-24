import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readListing,INDIA} from './nativeModels.js'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-pagination-20261120.json.gz',import.meta.url))))
const first=fixture.responses.find(p=>p.requestedUrl===INDIA),last=fixture.responses.find(p=>p.requestedUrl===INDIA+'&offset=20')
test('Adidas reads all 23 currently declared India search rows across the advertised 20-row offset',()=>{
 const opening=readListing(first.text),ending=readListing(last.text,{offset:20})
 assert.equal(opening.observedCount,23);assert.equal(opening.rows.length,20)
 assert.equal(ending.observedCount,23);assert.equal(ending.rows.length,3)
 assert.equal(new Set([...opening.rows,...ending.rows].map(row=>row.sourceUrl)).size,23)
})
test('Adidas pairs native details after paginating while respecting a caller result limit and retaining company hold',async()=>{
 const requests=[]
 const jobs=await run({maxJobs:1,minIntervalMs:0,now:()=>fixture.now,fetchImpl:async(url,init)=>{
  requests.push(url);assert.equal(init.method,'GET')
  const packet=fixture.responses.find(p=>p.requestedUrl===url);assert.ok(packet,'only own declared captured public URLs: '+url)
  return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(readSourceObservationEvidence(jobs,'adidas').observedRecordCount,23)
 assert.equal(requests.filter(url=>url===INDIA+'&offset=20').length,2)
 assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRoleClosingReconciled,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Adidas refuses a repeated first page as its final offset page',()=>{
 assert.throws(()=>readListing(first.text,{offset:20}),/count|offset|page|row/i)
})
test('Adidas preserves 23 mixed listing observations and 22 vacancies after holding the explicitly named talent pool',async()=>{
 const visits=new Map()
 const jobs=await run({minIntervalMs:0,now:()=>fixture.now,fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET')
  const index=visits.get(url)??0;visits.set(url,index+1)
  const packet=fixture.responses.filter(p=>p.requestedUrl===url)[index];assert.ok(packet,'only exact paired current original reads: '+url)
  return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }})
 assert.equal(jobs.length,22);assert.equal(jobs.filter(job=>job.country==='India').length,21)
 assert.deepEqual(readSourceObservationEvidence(jobs,'adidas'),{source:'adidas',recordKind:'mixed',observedRecordCount:23,observedVacancyCount:22,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(jobs.some(job=>/talent pool/i.test(job.title)),false)
 assert.equal(jobs.filter(job=>job.sourceDetailComplete).length,21)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const phase of ['opening','closing'])test(`Adidas retains original role criteria as partial when ${phase} offset transport is unavailable`,async()=>{
 const visits=new Map(),requests=[]
 const jobs=await run({maxJobs:1,minIntervalMs:0,now:()=>fixture.now,fetchImpl:async(url)=>{
  requests.push(url)
  const visit=(visits.get(url)??0)+1;visits.set(url,visit)
  if(url===INDIA+'&offset=20'&&visit===(phase==='opening'?1:2))return Object.defineProperty(new Response('Temporarily unavailable',{status:503,headers:{'content-type':'text/html'}}),'url',{value:url})
  const packet=fixture.responses.find(p=>p.requestedUrl===url);assert.ok(packet,'only captured current public URLs: '+url)
  return Object.defineProperty(new Response(packet.text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceDetailStatus,'partial')
 assert.equal(jobs[0].nativeRoleClosingReconciled,false)
 assert.ok(jobs[0].nativeJobDescription.length>750)
 assert.equal(jobs[0].sourceRawNativeRole,fixture.responses.find(p=>p.requestedUrl===requests.find(u=>u.startsWith('https://jobs.adidas-group.com/job/'))).text)
 const audit=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(audit.nativeRecords,phase==='opening'?20:23)
 assert.equal(audit.heldNativeRows.length,0)
 assert.match(audit.failures[0].message,/HTTP 503/)
 assert.equal(audit.opening.listing.paginationComplete,phase!=='opening')
 assert.equal(readSourceObservationEvidence(jobs,'adidas').sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Adidas keeps a changed closing offset page fail closed',async()=>{
 let offsets=0
 await assert.rejects(run({maxJobs:1,minIntervalMs:0,now:()=>fixture.now,fetchImpl:async(url)=>{
  const packet=fixture.responses.find(p=>p.requestedUrl===url);assert.ok(packet)
  const text=url===INDIA+'&offset=20'&&++offsets===2?first.text:packet.text
  return Object.defineProperty(new Response(text,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalUrl})
 }}),error=>{
  assert.match(error.message,/count|offset|page|row/i)
  assert.equal(error.recruitmentObservations.heldNativeRows.length,1)
  return true
 })
})
