import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
export const sapiensFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('./native-data-20261115.json.gz',import.meta.url))))
export const packetJSON=packet=>JSON.parse(Buffer.from(packet.bodyBase64,'base64'))
export function replacePacket(packet,value){
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value))
 return{...packet,bodyBase64:bytes.toString('base64'),bytes:bytes.length,sha256:sha(bytes),syntheticCounterfactual:true,provenance:{syntheticMutationOfOriginal:packet.provenance,physicalOriginalObserved:false}}
}
export function createSapiensReplay(change,packets=sapiensFixture().packets){
 const calls=[],pending=new Map()
 for(const packet of packets){const rows=pending.get(packet.requestedUrl)??[];rows.push(packet);pending.set(packet.requestedUrl,rows)}
 return{packets,calls,async fetchImpl(url,init={}){
  const rows=pending.get(String(url));assert(rows?.length,'Uncaptured Sapiens request '+url);assert.equal(init.method,'GET');assert.equal(init.body,undefined)
  const packet=rows.shift(),bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.sha256);assert.equal(bytes.length,packet.bytes)
  const call={url:String(url),init,packet};calls.push(call)
  const changed=await change?.(bytes,packet,calls.length,call,calls)
  if(changed instanceof Response)return changed
  const response=new Response(changed??bytes,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl,configurable:true});return response
 }}
}
// Only pacing waits are accelerated. Source/request deadline regression cases
// install their own measured clock, retaining all production ceilings.
export async function withSapiensReplayClock(operation){
 const own=Object.getOwnPropertyDescriptor(performance,'now'),clock=performance.now.bind(performance),timer=globalThis.setTimeout,fetch=globalThis.fetch
 let offset=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>clock()+offset})
 globalThis.setTimeout=(fn,ms,...args)=>ms>=400&&ms<=501?timer(()=>{offset+=Math.ceil(ms);fn(...args)},0):timer(fn,ms,...args)
 globalThis.fetch=()=>{throw Error('Unexpected real network in Sapiens replay')}
 try{return await operation()}finally{globalThis.fetch=fetch;globalThis.setTimeout=timer;if(own)Object.defineProperty(performance,'now',own);else delete performance.now}
}
export function assertSapiensCurrentJobs(jobs,packets=sapiensFixture().packets){
 const feed=packetJSON(packets[2]),selected=feed.jobAdDetails.filter(row=>row.country==='India'&&row.postingLocations.every(location=>location.country==='India')).slice(0,2)
 assert.deepEqual(jobs.map(job=>job.jobId),selected.map(row=>row.id))
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
 for(const[index,job]of jobs.entries()){
  const row=selected[index],form=packetJSON(packets[3+index*2]),closing=packetJSON(packets[10+index*2])
  assert.equal(Object.keys(row).length,24);assert.equal(job.title,row.title);assert.equal(job.country,'India');assert.equal(job.city,null);assert.equal(job.state,null)
  assert.equal(job.location,form.data.jobAd.site);assert.deepEqual(job.nativeSourceRecord,row);assert.deepEqual(job.nativeClosingSourceRecord,row);assert.deepEqual(job.nativePublicForm,form);assert.deepEqual(job.nativeClosingPublicForm,closing)
  assert.equal(Object.keys(form.metadata).length,17);assert.equal(Object.keys(form.data).length,4);assert.equal(job.nativeActualApplicationFormId,form.data.jobAd.applicationForm.id)
  assert.equal(job.sourceDescription,row.description+'\n<h2>Original native feed record</h2><pre>'+escape(JSON.stringify(row,null,2))+'</pre>\n<h2>Original public form data: actual intake and lookup options</h2><p>Lookup dictionaries contain reference options, not additional screening requirements.</p><pre>'+escape(JSON.stringify(form.data,null,2))+'</pre>')
  assert.equal(job.nativeOriginalRichDescription,row.description);assert.equal(job.description,job.sourceDescription);assert.equal(job.jobDescription,job.sourceDescription)
  assert.equal(job.postingDate,row.publishedAt);assert.equal(job.datePosted,row.publishedAt);assert.equal(job.postedDate,row.publishedAt);assert.match(job.postingDate,/\.\d{6}Z$/)
  assert.equal(job.sourceUrl,packets[4+index*2].requestedUrl)
  for(const key of ['applyUrl','link','nativeApplicationURL','nativeCanonicalURL','sourceCanonicalURL','firstEverPublication','validThrough','closingDate'])assert.equal(job[key],null,key)
  for(const key of ['firstParty','sourceCorporateBindingQualified','formalLegalEmployerQualified','activationVerified','currentCSSCoverage','clientDependencyCoverage','sourceRenderedCriteriaComplete','sourceApplicationQualificationComplete','sourceScopeComplete','sourceListingComplete','lifecycleCleanupAllowed','firstPublicationVerified','applicationVisited','nativeLandingContainsRoleData','genericMetadataQualifiedAsScreeningRequirements'])assert.equal(job[key],false,key)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeCriteriaTextComplete,true);assert.equal(job.nativeRoleClosingReconciled,true)
 }
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.physicalReads,14);assert.equal(audit.originalResponses.length,14);assert.equal(audit.nativeObservedRecordCount,feed.jobAdDetails.length)
 assert.equal(audit.declaredNativeIndiaCount,feed.jobAdDetails.filter(row=>row.country==='India').length);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.allSevenWholeCurrentBodiesClosed,true)
 assert.equal(audit.volatileFixtureValuesUsedAsAdmissionPins,false);assert.equal(audit.originalDecodedBytes,packets.reduce((sum,packet)=>sum+packet.bytes,0))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.deepEqual(readSourceObservationEvidence(jobs,'sapiens'),{source:'sapiens',recordKind:'vacancy-rows',observedRecordCount:feed.jobAdDetails.length,observedVacancyCount:feed.jobAdDetails.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
}
