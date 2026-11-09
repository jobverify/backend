import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {runCurrentJabilFeed} from '../../scraper/jabil.workday/currentPublicFeed.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
const sha=b=>createHash('sha256').update(b).digest('hex'),SOURCE='jabil',CORPORATE='https://www.jabil.com/',LIST='https://careers.jabil.com/.rest/delivery/jobs?all=true&slim=true'
let cached
function fixture(){
 if(cached)return cached
 const bytes=readFileSync(new URL('../test-data/recruitmentGoal20261107/jabil-current-controlled-20261107.json.gz',import.meta.url))
 assert.equal(sha(bytes),'2bf9b23eeb622000b4a32a0e2687f2cee895bd2f4cfc6a84e257dcabedf6efc8')
 const f=JSON.parse(gunzipSync(bytes));assert.equal(f.source,SOURCE);assert.equal(f.profile,'retained-92-body-native-feed-controlled-metadata-20261107');assert.equal(f.oracleSourceSHA256,'2410005fe0614dc79080395e8a9acbeab5c1f0997346145fb8ea242ee0c978a1')
 assert.equal(f.originalRecords.length,92);assert.equal(f.expectedDirect.jobs.length,86);assert.equal(f.responseMetadataReconstructed,true);assert.equal(f.actualLiveOutputParityClaimed,false)
 assert.equal(f.originalRegisteredReport.jabilRow.jobs,86);assert.equal(f.originalRegisteredReport.jabilRow.requests.length,92)
 for(let i=0;i<f.originalRecords.length;i++){const r=f.originalRecords[i],b=Buffer.from(f.entities[r.bodySHA256],'base64');assert.equal(r.sequence,i+1);assert.deepEqual(r.rawReceipt,f.originalRegisteredReport.jabilRow.requests[i]);assert.equal(sha(b),r.bodySHA256);assert.equal(b.length,r.bodyBytes);assert.equal(r.rawReceipt.sha256,r.bodySHA256);assert.equal(r.rawReceipt.bytes,r.bodyBytes);assert.equal(r.rawReceipt.status,200)}
 const lists=f.originalRecords.filter(r=>r.rawReceipt.url===LIST);assert.equal(lists.length,2);const opening=JSON.parse(Buffer.from(f.entities[lists[0].bodySHA256],'base64')),closing=JSON.parse(Buffer.from(f.entities[lists[1].bodySHA256],'base64'));assert.deepEqual(opening.jobs,closing.jobs);assert.equal(opening.jobs.length,2125)
 assert.equal(f.everyDetailClosingReread,false);assert.equal(f.sourceScopeComplete,false);assert.equal(f.lifecycleCleanupAllowed,false);assert.equal(f.newNetworkRequests,0);assert.equal(f.programsExecuted,false)
 cached=f;return f
}
const values=x=>x===undefined?{$snapshotType:'undefined'}:Array.isArray(x)?x.map(values):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,values(v)])):x
function snapshot(jobs){const properties={},symbolProperties={};for(const key of Reflect.ownKeys(jobs)){if(key==='length'||typeof key==='string'&&/^\d+$/.test(key))continue;const d=Object.getOwnPropertyDescriptor(jobs,key);assert.ok(Object.hasOwn(d,'value'));const into=typeof key==='symbol'?symbolProperties:properties,name=typeof key==='symbol'?Symbol.keyFor(key):key;assert.ok(name);into[name]={value:values(d.value),enumerable:d.enumerable,configurable:d.configurable,writable:d.writable}}return{jobs:[...jobs],properties,symbolProperties,inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,SOURCE)}}
function initSnapshot(init){const result={};for(const key of Object.keys(init).sort()){if(key==='headers')result[key]=Object.fromEntries(new Headers(init.headers));else if(key==='signal'){assert.ok(init.signal instanceof AbortSignal);result[key]={type:'AbortSignal'}}else result[key]=values(init[key])}return result}
export async function assertJabilCurrentExtraction(t,provider){
 assert.equal(provider.source,SOURCE);const f=fixture(),allCalls=[]
 for(const direct of [true,false]){
  const calls=[],counts=new Map(),fetchImpl=async(input,init={})=>{const url=String(input),copies=f.originalRecords.filter(r=>r.rawReceipt.url===url),n=counts.get(url)??0;assert.ok(copies[n],'Only92 retained URL copies may run; no list reuse or guessed route: '+url);counts.set(url,n+1);const r=copies[n],expected=f.controlledRequests.find(c=>c.originalSequence===r.sequence);assert.ok(expected);assert.deepEqual(initSnapshot(init),expected.init,'Controlled original-source request init stays exact');calls.push({url,bodySHA256:r.bodySHA256,originalSequence:r.sequence});const response=new Response(Buffer.from(f.entities[r.bodySHA256],'base64'),{status:r.rawReceipt.status,headers:{'content-type':f.controlledMIMEByURL[url]}});Object.defineProperty(response,'url',{value:url});return response}
  t.mock.method(globalThis,'fetch',fetchImpl)
  const options={now:()=>f.controlledCollectionClock,fetchImpl},jobs=await(direct?runCurrentJabilFeed(options):createCatalogScraper(provider).run(options))
  assert.equal(calls.length,92);for(const r of f.originalRecords)assert.equal(counts.get(r.rawReceipt.url),f.originalRecords.filter(p=>p.rawReceipt.url===r.rawReceipt.url).length)
  assert.deepEqual(calls.slice(0,5).map(c=>c.bodySHA256),f.controlledRequests.slice(0,5).map(c=>c.bodySHA256));assert.equal(calls.at(-1).url,LIST)
  assert.deepEqual(calls.slice(5,-1).map(c=>c.originalSequence).sort((a,b)=>a-b),f.controlledRequests.slice(5,-1).map(c=>c.originalSequence).sort((a,b)=>a-b),'Concurrent details match all86 original bodies; no original launch-order claim')
  assert.deepEqual(snapshot(jobs),direct?f.expectedDirect:f.expectedRegistered,'Entire controlled old-source oracle, every own metadata/symbol and native field; no business omissions')
  assert.deepEqual(jobs.map(j=>j.jobId),f.selectedNativeDetailIds);assert.equal(jobs.length,86);assert.equal(readSourceObservationEvidence(jobs,SOURCE),null)
  const legacy=jobs[Symbol.for('jobverify.verified-recruitment-observations')];assert.equal(legacy.nativeRecords,2125);assert.equal(legacy.returnedIndiaJobs,86);assert.equal(legacy.requestCount,92);assert.equal(legacy.sourceScopeComplete,false);assert.equal(legacy.lifecycleCleanupAllowed,false)
  const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(isVerifiedEmptyEvidence(inventory),false)
  for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.source,SOURCE);assert.equal(job.sourceDescription,job.nativeSourceRecord.Job_Description);assert.equal(job.postingDate,job.nativeSourceRecord.Start_Date);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.applicationVisited??false,false)}
  allCalls.push({direct,calls})
 }
 // Body acquisition is genuine. FinalURL/MIME/init/collection-clock values are
 // explicitly controlled projections; this is not entire original live output.
 return{jobs:86,calls:allCalls,actualLiveOutputParityClaimed:false}
}
export async function assertJabilPrimaryDenial(t,provider){
 assert.equal(provider.source,SOURCE);const f=fixture(),d=f.controlledDenial;assert.equal(d.syntheticNegative,true);assert.equal(d.currentLiveDenialClaimed,false);let calls=0
 const fetchImpl=async(input,init={})=>{calls++;assert.equal(String(input),CORPORATE);assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual');const response=new Response(d.body,{status:403,headers:{'content-type':d.mime}});Object.defineProperty(response,'url',{value:String(input)});return response}
 t.mock.method(globalThis,'fetch',fetchImpl)
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl}),error=>{assert.equal(error.status??error.cause?.status,403);assert.equal(error.cause?.status,403);assert.equal(error.abortRetries,true);assert.match(error.message,/HTTP.*403|403.*HTTP/i);assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'});assert.notEqual(error.lifecycleCleanupAllowed,true);if(error.inventoryEvidence){assert.equal(isVerifiedEmptyEvidence(error.inventoryEvidence),false);assert.equal(error.inventoryEvidence.listingComplete,false);assert.equal(error.inventoryEvidence.reportedTotal,null)}return true})
 assert.equal(calls,1,'Primary403 rejects without retry, fallback or empty inventory; source does not expose a full denied audit')
}
