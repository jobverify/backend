import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {runAdityaBirlaRealEstatePublicRead} from '../../scraper/adityabirlarealestate.workday/currentPublic.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const SOURCE='adityabirlarealestate',HOME='https://www.adityabirlarealestate.com/career'
const sha=b=>createHash('sha256').update(b).digest('hex')
function fixture(){
 const bytes=readFileSync(new URL('../test-data/recruitmentGoal20261107/adityabirlarealestate-partial-current.json.gz',import.meta.url))
 assert.equal(sha(bytes),'945e7395df39acb2c51534a688fb75b8274fa7738a621fa2a2a5f0ddc01b1a36')
 const f=JSON.parse(gunzipSync(bytes));assert.equal(f.source,SOURCE);assert.equal(f.profile,'genuine-C35-C36-partial-careers-contexts-20261107')
 assert.equal(f.oracleSourceSHA256,'242d2614869f717d44b90b4b5b92ec688fc52e3c50ab2c7a3454f9f953b51ce1')
 assert.equal(f.packets.length,4);assert.equal(f.cases.length,2);assert.equal(f.newNetworkRequests,0);assert.equal(f.remoteProgramsExecuted,false)
 assert.deepEqual(f.packets.map(p=>p.bodySHA256),['274c4d271fae67acbfefc6e77b59c92b92ef8782fa932b120c89ccabef280bdb','2c41e984030493db10cff9907bb4021737ae0b57687049a91a4abc8498cc72e2','d062a69c406266a6b23102f265d38b3564f5d6c5f8aebc72c61fb73c4a212036','6ac20118ab86c6b6a328c229d48925cb59a75e16431d804eb75b45b0e889ea39'])
 for(const p of f.packets){const body=Buffer.from(p.bodyBase64,'base64');assert.equal(body.length,p.bodyBytes);assert.equal(sha(body),p.bodySHA256);assert.equal(p.rawReceipt.sha256,p.bodySHA256);assert.equal(p.rawReceipt.bytes,p.bodyBytes);assert.equal(p.rawReceipt.status,200);assert.equal(p.programExecuted,false);assert.deepEqual(f.nativeManifests[p.originManifest].records.find(r=>r.requestId===p.rawReceipt.requestId),p.rawReceipt)}
 return f
}
function page(p){const r=p.rawReceipt,b=Buffer.from(p.bodyBase64,'base64');return{url:r.finalUrl,finalUrl:r.finalUrl,requestedUrl:r.requestedUrl,status:r.status,headers:structuredClone(r.headers),contentType:r.contentType,bodyBase64:p.bodyBase64,html:b.toString('utf8'),bytes:r.bytes,sha256:r.sha256,sourceRequestedAt:r.sourceRequestedAt,sourceCompletedAt:r.sourceCompletedAt,sourceHttpDate:r.sourceHttpDate,originalReceipt:structuredClone(r)}}
const values=x=>x===undefined?{$snapshotType:'undefined'}:Array.isArray(x)?x.map(values):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,values(v)])):x
function snapshot(jobs){
 const properties={},symbolProperties={}
 for(const k of Reflect.ownKeys(jobs)){
  if(k==='length'||typeof k==='string'&&/^\d+$/.test(k))continue
  const d=Object.getOwnPropertyDescriptor(jobs,k);assert.ok(Object.hasOwn(d,'value'),'All retained metadata remains data, without getter execution')
  const r={value:values(d.value),enumerable:d.enumerable,configurable:d.configurable,writable:d.writable}
  if(typeof k==='symbol'){assert.ok(Symbol.keyFor(k));symbolProperties[Symbol.keyFor(k)]=r}else properties[k]=r
 }
 return{jobs:[...jobs],properties,symbolProperties,inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,SOURCE)}
}
function initSnapshot(init){assert.ok(init.signal instanceof AbortSignal);assert.equal(typeof init.throwIfAborted,'function');return{method:init.method,redirect:init.redirect,credentials:init.credentials,maxResponseBytes:init.maxResponseBytes,headers:Object.fromEntries(new Headers(init.headers)),signalType:'AbortSignal',throwIfAbortedType:'function',keys:Object.keys(init).sort()}}
function partial(jobs,p){
 assert.equal(jobs.length,0,'Genuine evidence supplies no qualified job')
 const a=jobs.nativeCollectionEvidence,i=readInventoryEvidence(jobs),o=readSourceObservationEvidence(jobs,SOURCE)
 assert.equal(i.status,'coverage-gap');assert.equal(i.listingComplete,false);assert.equal(i.reportedTotal,null);assert.equal(i.indiaFacetCount,null);assert.equal(i.verifiedAt,null);assert.equal(isVerifiedEmptyEvidence(i),false)
 assert.deepEqual(o,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:3,observedVacancyCount:3,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null});assert.equal(Object.isFrozen(o),true)
 assert.equal(a.observations.length,3);assert.deepEqual(a.observations.map(r=>[r.title,r.publishedLocation,r.publishedDivision]),[['Head - Engineering, Century Pulp & Paper','Lalkuan, Uttarakhand','Century Pulp & Paper'],['Head - Production, Planning & Control, Century Pulp & Paper','Lalkuan, Uttarakhand','Century Pulp & Paper'],['Finance & Accounts - Team Member, Head Office','Mumbai','Head Office']])
 for(const r of a.observations){assert.equal(r.qualification,'partial');assert.equal(r.country,null);assert.equal(r.legalEmployer,null);assert.equal(r.typedCountryPresent,false);assert.equal(r.typedLegalEmployer,null);assert.equal(r.criteriaVisibilityQualified,false);assert.equal(r.eligibilityQualified,false);assert.equal(r.sourceDetailComplete,false);assert.equal(r.sourceScopeComplete,false);assert.equal(r.lifecycleCleanupAllowed,false);assert.equal(r.applicationInteractionPerformed,false);assert.ok(r.criteriaItems.length>0);assert.equal(r.criteriaText,'Job Description '+r.criteriaItems.join(' '))}
 for(const key of ['companyGlobalTotal','companyIndiaTotal','nativeReportedTotal','nativeIndiaTotal','inventoryVerifiedAt'])assert.equal(a[key],null)
 for(const key of ['sourceScopeComplete','sourceListingComplete','sourceDetailComplete','lifecycleCleanupAllowed','corporateJavaScriptExecuted','subresourcesRequested','applicationInteractionPerformed','redirectsFollowed'])assert.equal(a[key],false)
 assert.equal(a.responses.length,1);assert.equal(a.responses[0].sha256,p.bodySHA256);assert.equal(a.responses[0].bodyBase64,p.bodyBase64);assert.equal(a.responses[0].status,200);assert.equal(a.responses[0].transportQualified,true);assert.equal(a.responses[0].sourceRequestedAt,p.rawReceipt.sourceRequestedAt);assert.equal(a.responses[0].sourceCompletedAt,p.rawReceipt.sourceCompletedAt);assert.deepEqual(a.rawPages[0].originalReceipt,p.rawReceipt)
}
export async function assertAdityaBirlaRealEstatePartialExtraction(t,provider){
 assert.equal(provider.source,SOURCE);const f=fixture(),registeredCalls=[],directCalls=[]
 for(const c of f.cases){
  assert.deepEqual(c.actualRequestSequence,[c.packetIndex]);assert.equal(c.closingRecheckPerformed,false)
  for(const direct of [true,false]){
   const calls=[],audits=[],metadata=[],records=[],p=f.packets[c.packetIndex]
   const options={now:()=>f.controlledCollectionClock,fetchPage:async(url,init)=>{assert.equal(calls.length,0,'Only one genuine configured-document request per independent replay');assert.equal(url,HOME);calls.push({url,init:initSnapshot(init),packetIndex:c.packetIndex});return page(p)},onAudit:a=>audits.push(a),onMetadata:m=>metadata.push(m),onRecords:r=>records.push(r)}
   const jobs=await(direct?runAdityaBirlaRealEstatePublicRead(options):createCatalogScraper(provider).run(options))
   assert.deepEqual(calls,c.expectedRequestCalls);assert.deepEqual(snapshot(jobs),direct?c.expectedDirect:c.expectedRegistered,'Whole C36 healthy oracle, every own property/symbol and native field; no clock/business omissions')
   assert.deepEqual({audits,metadata,records},c.expectedCallbacks);partial(jobs,p)
   if(direct){assert.equal(jobs.sourceAudit,jobs.nativeCollectionEvidence);assert.deepEqual(jobs.metadata,jobs.sourceAudit.sourceMetadata);directCalls.push(...calls)}else registeredCalls.push(...calls)
  }
 }
 assert.deepEqual(registeredCalls.map(c=>c.packetIndex),[0,1]);assert.deepEqual(directCalls.map(c=>c.packetIndex),[0,1])
 // These are two independent one-document replays. Home and inert script are
 // retained provenance only; no closing packet, browser execution or typed India is inferred.
 return{jobs:[],calls:registeredCalls,directCalls,qualifiedJobs:0,partialObservations:3,independentCareersBodies:2,closingRecheckClaimed:false}
}
export async function assertAdityaBirlaRealEstatePrimaryDenial(t,provider){
 assert.equal(provider.source,SOURCE);const f=fixture(),d=f.controlledDenial;let calls=0;const audits=[]
 assert.equal(d.syntheticNegative,true);assert.equal(d.currentLiveDenialClaimed,false)
 await assert.rejects(createCatalogScraper(provider).run({now:()=>f.controlledCollectionClock,fetchPage:async(url,init)=>{calls++;assert.equal(url,HOME);assert.deepEqual(initSnapshot(init),f.cases[0].expectedRequestCalls[0].init);return structuredClone(d.page)},onAudit:a=>audits.push(a)}),e=>{
  assert.equal(e.status,403);assert.equal(e.failureKind,'blocked_or_access_denied');assert.equal(e.softFailure,true);assert.equal(e.upstreamOutage,true);assert.equal(e.abortRetries,true);assert.equal(e.lifecycleCleanupAllowed,false);assert.match(e.message,/HTTP.*403/)
  assert.deepEqual(classifyScraperError(e),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'})
  assert.deepEqual(e.sourceAudit,d.expectedSourceAudit);assert.deepEqual(e.inventoryEvidence,d.expectedInventory);assert.equal(isVerifiedEmptyEvidence(e.inventoryEvidence),false);assert.equal(e.inventoryEvidence.reportedTotal,null);assert.equal(e.inventoryEvidence.indiaFacetCount,null);assert.equal(e.inventoryEvidence.listingComplete,false)
  const a=e.sourceAudit;assert.equal(a.outcome,'failed');assert.equal(a.sourceScopeComplete,false);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.companyGlobalTotal,null);assert.equal(a.companyIndiaTotal,null);assert.equal(a.nativeReportedTotal,null);assert.equal(a.nativeIndiaTotal,null);assert.equal(a.responses.length,1);assert.equal(a.responses[0].status,403);assert.equal(a.responses[0].bodyBase64,d.page.bodyBase64);assert.equal(a.responses[0].sha256,sha(Buffer.from('Forbidden')));assert.equal(a.responses[0].bodyComplete,true);assert.equal(a.responses[0].transportQualified,false);assert.deepEqual(a.observations,[]);assert.deepEqual(audits,[d.expectedSourceAudit])
  return true
 })
 assert.equal(calls,1,'No retry/fallback or invented empty inventory after primary403')
}
