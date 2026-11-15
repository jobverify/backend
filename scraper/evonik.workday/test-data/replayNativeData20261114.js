import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../../scraper-support/utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
export const currentEvonikFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./native-data-20261114.json.gz',import.meta.url))))
const key=(url,init={})=>(init.method??'GET')+' '+url+' '+(init.body??'')

// Closing-body reuse here is fixture replay only. It never proves live closure.
export function createEvonikReplay(change){
 const fixture=currentEvonikFixture(),calls=[],counts=new Map(),packets=new Map()
 for(const item of fixture.schedule){
  const packet=fixture.packets[item.packetIndex],id=key(packet.requestedUrl,{method:packet.method,body:packet.requestBody})
  const rows=packets.get(id)??[];rows.push(packet);packets.set(id,rows)
 }
 const legacy=fixture.packets[fixture.legacyCorporate404PacketIndex]
 return{fixture,calls,async fetchImpl(url,init={}){
  const id=key(url,init),count=(counts.get(id)??0)+1;counts.set(id,count)
  const rows=packets.get(id),packet=rows?.[Math.min(count-1,rows.length-1)]??(url===legacy.requestedUrl?legacy:null)
  assert.ok(packet,'Uncaptured Evonik request '+id)
  const original=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(original),packet.sha256);assert.equal(original.length,packet.bytes)
  const call={url,init,packet,count};calls.push(call)
  const replacement=await change?.(original,packet,count,call,calls)
  if(replacement instanceof Response)return replacement
  const response=new Response(replacement??original,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl,configurable:true})
  return response
 }}
}

// Test-only virtual pacing: production exposes no pacing/deadline bypass.
// Only the source's approximately500ms wait advances the monotonic test clock;
// original request/source deadlines remain unchanged and all globals restore.
export async function withEvonikReplayClock(operation){
 const own=Object.getOwnPropertyDescriptor(performance,'now'),clock=performance.now.bind(performance),timer=globalThis.setTimeout,fetch=globalThis.fetch
 let offset=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>clock()+offset})
 globalThis.setTimeout=(fn,ms,...args)=>ms>=400&&ms<=501?timer(()=>{offset+=Math.ceil(ms);fn(...args)},0):timer(fn,ms,...args)
 globalThis.fetch=()=>{throw Error('Unexpected real network in Evonik replay')}
 try{return await operation()}finally{
  globalThis.fetch=fetch;globalThis.setTimeout=timer
  if(own)Object.defineProperty(performance,'now',own);else delete performance.now
 }
}

export function assertEvonikCurrentJobs(jobs,fixture){
 assert.deepEqual(jobs.map(job=>job.jobId),fixture.expectedIndiaIds)
 assert.equal(jobs.length,10)
 for(const pair of fixture.rolePairs){
  const original=JSON.parse(Buffer.from(fixture.packets[pair.APIPacketIndex].bodyBase64,'base64')),job=jobs.find(row=>row.jobId===pair.id)
  assert.equal(job.country,'India');assert.equal(job.companyName,'Evonik')
  assert.deepEqual(job.nativeWorkdayRecord,original);assert.deepEqual(job.nativeClosingWorkdayRecord,original)
  assert.equal(job.sourceDescription,job.nativeSourceRecord.description)
  assert.equal(job.sourceNativeDescriptionHTML,original.jobPostingInfo.jobDescription)
  assert.equal(job.nativeHiringOrganization.name,original.hiringOrganization.name)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.activationVerified,false);assert.equal(job.currentCSSCoverage,false)
  assert.equal(job.sourceApplicationQualificationComplete,false);assert.equal(job.nativeApplicationURL,null)
  assert.equal(job.nativeApplicationActionVerified,false);assert.equal(job.sourceDetailComplete,true)
 }
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.observedIndiaRows,11);assert.equal(jobs.nativeCollectionEvidence.unhydratedIndiaRows[0].bulletFields[0],'R52151')
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
}

export async function assertEvonikCurrentExtraction(_t,provider){
 const io=createEvonikReplay()
 const jobs=await withEvonikReplayClock(()=>createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,now:()=> '2026-11-14T23:05:20.335Z'}))
 assertEvonikCurrentJobs(jobs,io.fixture);assert.equal(io.calls.length,48)
 return{jobs,calls:io.calls}
}

export async function assertEvonikCurrentDenial(_t,provider){
 let calls=0
 await assert.rejects(()=>createCatalogScraper(provider).run({fetchImpl:async url=>{
  calls++;const response=new Response('Original native access denied',{status:403,headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>error.status===403&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false)
 assert.equal(calls,1)
}
