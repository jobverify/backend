import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL} from './script.js'
import {validateCurrentPublicSnapshot} from './currentPublic20261128.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden,isCompleteScraperAttempt,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {isAuthoritativeEmptyScrape} from '../../scraper-support/runner.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-public-20261128.json.gz',import.meta.url))))
const bodies=new Map(fixture.packets.map(packet=>[packet.url,packet]))
const now=()=> '2026-11-28T03:00:00.000Z'
function response(packet,body=packet.body){return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})}
function replay(context,mutate=(url,body)=>body){
 const previous=globalThis.fetch,counts=new Map(),requests=[]
 context.after(()=>{globalThis.fetch=previous})
 globalThis.fetch=async(input,options)=>{const url=String(input),packet=bodies.get(url);assert.ok(packet,'Undeclared read '+url);requests.push({url,options});const n=(counts.get(url)??0)+1;counts.set(url,n);assert.equal(options.method??'GET','GET');return response(packet,mutate(url,packet.body,n))}
 return {counts,requests}
}

test('current exact public career profile pairs its native empty data without inferring company totals or cleanup',async context=>{
 const transport=replay(context);let audit
 const jobs=await run({now,onAudit:value=>{audit=structuredClone(value);value.companyIndiaTotal=999;value.opening.programs[0].body='callback mutation'}})
 assert.equal(jobs.length,0);assert.equal(transport.requests.length,40);assert.equal(transport.counts.get(CAREERS_URL),2)
 for(const request of transport.requests)assert.equal(request.options.credentials,'omit')
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.configuredPublicNativeDataEmpty,true);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.browserRenderingQualified,false);assert.equal(audit.applicationQualified,false)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.notEqual(jobs.nativeCollectionEvidence.opening.programs[0].body,'callback mutation')
})

test('a closing current frame change is terminal after preserving the actual paired read boundary',async context=>{
 const transport=replay(context,(url,body,n)=>url===CAREERS_URL&&n===2?body+'\n<!-- changed closing -->':body)
 await assert.rejects(run({now}),/current|closing|profile|frame/i)
 assert.equal(transport.counts.get(CAREERS_URL),2)
})

test('an opaque pre-aborted caller starts no page read and retains null exactly',async context=>{
 const transport=replay(context),controller=new AbortController();controller.abort(null)
 await assert.rejects(run({now,signal:controller.signal}),error=>error===null)
 assert.equal(transport.requests.length,0)
})

test('the default native reader rejects an oversized streamed entity before current profile parsing',async context=>{
 const previous=globalThis.fetch;context.after(()=>{globalThis.fetch=previous})
 let cancelled=0
 const bytes=new Uint8Array(16*1024*1024+1)
 const reader={read:async()=>({done:false,value:bytes}),cancel:async()=>{cancelled++},releaseLock(){}}
 globalThis.fetch=async()=>({ok:true,status:200,url:CAREERS_URL,headers:new Headers({'content-type':'text/html'}),text:async()=>Buffer.from(bytes).toString(),body:{getReader:()=>reader}})
 await assert.rejects(run({now}),/byte budget|too large|byte bound/i)
 assert.equal(cancelled,1)
})

const snapshot=()=>({career:bodies.get(CAREERS_URL).body,homepage:bodies.get('https://www.ganitinc.com/').body,
 programs:fixture.packets.filter(packet=>packet.url.endsWith('.js')).map(packet=>({url:packet.url,body:packet.body}))})

test('twenty genuine observed bodies retain their original metadata and explicitly offline closing limitations',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.validCurrentCheck,false);assert.equal(fixture.closingTransportIsOfflineReplay,true);assert.equal(fixture.programsExecuted,false)
 assert.equal(fixture.packets.length,20);assert.equal(validateCurrentPublicSnapshot(snapshot()).configuredBoardComplete,false)
 const home=fixture.packets.find(packet=>packet.url==='https://www.ganitinc.com/')
 assert.equal(home.requestedUrl,'https://ganitinc.com/')
})

test('a missing, duplicated or foreign graph program cannot qualify a current native empty state',()=>{
 const missing=snapshot();missing.programs.pop();assert.throws(()=>validateCurrentPublicSnapshot(missing),/program/)
 const duplicate=snapshot();duplicate.programs[0]=structuredClone(duplicate.programs[1]);assert.throws(()=>validateCurrentPublicSnapshot(duplicate),/program/)
 const foreign=snapshot();foreign.programs[0].url='https://foreign.invalid/assets/current.js';assert.throws(()=>validateCurrentPublicSnapshot(foreign),/program/)
})

test('each complete declared own program is independently bound, including dependency and framework code',()=>{
 for(let index=0;index<18;index++){
  const changed=snapshot();changed.programs[index].body+='\n/* unreviewed whole programme */'
  assert.throws(()=>validateCurrentPublicSnapshot(changed),/complete current program profile changed/)
 }
})

test('neither modified corporate identity nor an inert empty-state frame can qualify the current native page',()=>{
 const home=snapshot();home.homepage+='\n<!-- corporate change -->';assert.throws(()=>validateCurrentPublicSnapshot(home),/corporate frame/)
 const inert=snapshot();inert.career=inert.career.replace('id="cg-roles"','id="cg-roles" hidden');assert.throws(()=>validateCurrentPublicSnapshot(inert),/frame/)
})

test('the historical body-only seam cannot independently certify the new public profile',async()=>{
 let reads=0
 await assert.rejects(run({now,fetchText:async()=>{reads++;return bodies.get(CAREERS_URL).body}}),/official Ganit careers page/)
 assert.equal(reads,1)
})

test('ordinary current transport rejects typed denials and challenge headers before interpreting a native page',async context=>{
 const previous=globalThis.fetch;context.after(()=>{globalThis.fetch=previous})
 for(const [status,headers]of[[403,{}],[429,{}],[200,{'cf-mitigated':'challenge'}],[200,{'x-amzn-waf-action':'challenge'}]]){
  let reads=0
  globalThis.fetch=async()=>{reads++;return Object.defineProperty(new Response('held',{status,headers}),'url',{value:CAREERS_URL})}
  await assert.rejects(run({now}),error=>error.httpStatus===status&&error.abortRetries===true&&error.failureKind==='blocked_or_access_denied')
  assert.equal(reads,1)
 }
})

test('a foreign final response URL is terminal before any own program read',async context=>{
 const previous=globalThis.fetch;context.after(()=>{globalThis.fetch=previous});let reads=0
 globalThis.fetch=async()=>{reads++;return Object.defineProperty(new Response(bodies.get(CAREERS_URL).body,{status:200,headers:{'content-type':'text/html'}}),'url',{value:'https://foreign.invalid/careers'})}
 await assert.rejects(run({now}),error=>error.failureKind==='parser_or_contract_error'&&error.abortRetries===true)
 assert.equal(reads,1)
})

test('registered configured-page-only empty observation remains an incomplete acquisition without authoritative source zero',async context=>{
 const transport=replay(context),provider=getScraperCatalog().find(row=>row.source==='ganit')
 const jobs=await createCatalogScraper(provider).run({now})
 const assessment=assessSoftFailureAcquisition(provider,jobs),inventory=readInventoryEvidence(jobs)
 assert.equal(transport.requests.length,40);assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.configuredPublicNativeDataEmpty,true)
 assert.equal(jobs.nativeCollectionEvidence.configuredBoardComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null)
 assert.equal(isVerifiedEmptyEvidence(inventory),false);assert.equal(isAuthoritativeEmptyScrape({provider},jobs),false)
 assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.runnerOutcome.partial,true)
 assert.equal(isCompleteScraperAttempt(assessment.runnerOutcome),false);assert.equal(assessment.zeroJobEvidence,'coverage-gap')
 assert.deepEqual(assessment.cleanupOptions,{replaceExisting:false})
})
