import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {assertTwoUPublicExtraction,assertTwoUPublicDenial} from './replayTwoUPublicInventory20261107C31.js'
import {assertNCSControlledExtraction,assertNCSCurrentDenial} from './replayNCSPartialInventory20261107.js'
import {assertIkeaCurrentExtraction,assertIkeaCurrentDenial} from './replayIkeaNative20261107.js'
import {assertBiltCurrentForeignExtraction,assertBiltPrimaryDenial} from './replayBiltNative20261107.js'
import {assertFerreroCurrentLifecycleHolds,assertFerreroPrimaryDenial} from './replayFerreroNative20261107.js'
import {assertReutersCurrentExtraction,assertReutersPrimaryDenial} from './replayReutersNative20261107.js'
import {assertAdityaBirlaRealEstatePartialExtraction,assertAdityaBirlaRealEstatePrimaryDenial} from './replayAdityaBirlaRealEstatePartial20261107.js'
import {assertJabilCurrentExtraction,assertJabilPrimaryDenial} from './replayJabilCurrentFeed20261107.js'
import {assertBigeyeGemContract,assertBigeyeGemDenial} from './replayBigeyeGemContract20261108.js'

// These source-owned current readers require their declared native contracts.
// The remaining cohort members still exercise the generic controlled HTML path.
export const specializedBatchSources=new Set(['adidas','aecom','aecomindia','corteva','lyrahealth','unosecur','kkr','precisely','mannhummel','corning','priceline','moodys','moodyscorporation','stantec','synchronyfinancial','evonik','2u','xerox','ncs','ikea','bilt','ferrero','reuters','adityabirlarealestate','jabil','bigeye'])
export const currentCatalogBindingDates={unosecur:'2026-11-06',kkr:'2026-11-06',precisely:'2026-11-06',mannhummel:'2026-11-06'}
export const currentModuleBindingDates={lyrahealth:'2026-11-05',unosecur:'2026-11-06'}
const sha=b=>createHash('sha256').update(b).digest('hex'),cache=new Map()
const key=(url,init={})=>(init.method||'GET')+':'+url+':'+(init.body||'')
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value
const json=url=>JSON.parse(gunzipSync(readFileSync(url)))
const specs={
 adidas:{count:9,reads:28,now:'2026-11-05T21:20:00.000Z'},
 aecom:{count:380,reads:845,now:'2026-11-06T18:00:00.000Z'},
 aecomindia:{count:380,reads:845,now:'2026-11-06T18:00:00.000Z'},
 corteva:{count:2,reads:26,now:'2026-11-06T16:40:00.000Z'},
 lyrahealth:{count:7,reads:42,now:'2026-11-05T08:05:00.000Z'},
 unosecur:{count:3,reads:16,now:'2026-11-05T20:00:00.000Z'},
 kkr:{count:19,reads:10,now:'2026-11-06T00:30:00.000Z'},
 precisely:{count:9,reads:8,now:'2026-11-05T23:59:00.000Z'},
 mannhummel:{count:13,reads:32,now:'2026-11-05T23:10:00.000Z'},
 // Both manifests also retain extra research entities outside the current route.
 corning:{count:32,reads:36,now:'2026-11-06T17:00:00.000Z'},
 priceline:{count:23,reads:59,now:'2026-11-06T18:00:00.000Z'},
 moodyscorporation:{count:44,reads:104,now:'2026-11-06T18:30:00.000Z'},
 synchronyfinancial:{count:15,reads:38,now:'2026-11-06T20:30:00.000Z'},
 stantec:{count:55,reads:158,now:'2026-11-06T18:00:00.000Z'},
 evonik:{count:7,reads:38,now:'2026-11-06T21:26:46.101Z'},
}
function sourceFixture(source){
 const canonical=source==='aecomindia'?'aecom':source
 if(cache.has(canonical))return cache.get(canonical)
 let fixture,rows
 if(canonical==='evonik'){
  const directory=new URL('../../scraper/evonik.workday/test-data-20261107/',import.meta.url)
  fixture=JSON.parse(readFileSync(new URL('manifest.json',directory)))
  rows=fixture.requests.map(p=>({...p,requestedURL:p.url,bytes:gunzipSync(readFileSync(new URL(p.bodySHA256+'.gz',directory)))}))
 }else if(['corning','priceline','moodyscorporation','synchronyfinancial'].includes(canonical)){
  const directory=new URL('../../scraper/'+canonical+'.workday/test-data-'+(canonical==='synchronyfinancial'?'20261107':'20261106')+'/',import.meta.url)
  fixture=JSON.parse(readFileSync(new URL('manifest.json',directory)))
  rows=fixture.requests.map(p=>({...p,requestedURL:p.url,bodySHA256:p.bodySHA256||p.hash,bodyBytes:p.bodyBytes??p.bytes,bytes:gunzipSync(readFileSync(new URL((p.bodySHA256||p.hash)+'.gz',directory)))}))
 }else{
  const current=['aecom','corteva','stantec'].includes(canonical)
  fixture=json(new URL('../test-data/'+(current?'recruitmentGoal20261106/'+canonical+'-current':'recruitmentGoal20261104/'+canonical+'-native-quality')+'.json.gz',import.meta.url))
  rows=fixture.packets.filter(p=>p.cohort!=='historical-failed-generic-route').map(p=>({...p,bytes:typeof p.bodyBase64==='string'?Buffer.from(p.bodyBase64,'base64'):Buffer.from(p.bodyText)}))
 }
 for(const p of rows){assert.equal(p.bytes.length,p.bodyBytes);assert.equal(sha(p.bytes),p.bodySHA256)}
 const result={fixture,rows};cache.set(canonical,result);return result
}
function currentTransport(t,source,denied=false){
 // Fixture selection follows the existing shared native reader. The provider
 // and returned job source retain the caller's actual registration name.
 source=source==='moodys'?'moodyscorporation':source
 const {fixture,rows}=sourceFixture(source),calls=[],counts=new Map(),groups=new Map()
 const identityFor=(url,init={})=>['moodyscorporation','synchronyfinancial'].includes(source)?key(url,{...init,body:init.body?JSON.stringify(canonical(JSON.parse(init.body))):null}):key(url,init)
 for(const p of rows){const identity=identityFor(p.requestedURL,p);if(!groups.has(identity))groups.set(identity,[]);groups.get(identity).push(p)}
 const fetchImpl=async(input,init={})=>{
  const url=String(input),identity=identityFor(url,init),copies=groups.get(identity),n=(counts.get(identity)||0)+1;counts.set(identity,n)
  assert.ok(copies?.length,'Only retained current native requests may run: '+identity)
  const research=copies.filter(p=>p.cohort==='current-native-research'),available=research.length?research:copies
  if(source==='priceline'||source==='moodyscorporation'||source==='synchronyfinancial'||source==='evonik')assert.ok(available[n-1],source+' capture does not permit an extra request: '+identity)
  const p=available[Math.min(n-1,available.length-1)]
  assert.equal(init.method||'GET',p.method)
  if(['moodyscorporation','synchronyfinancial'].includes(source)&&init.body)assert.deepEqual(JSON.parse(init.body),JSON.parse(p.body))
  else assert.equal(init.body||null,p.body||null)
  if(source==='corning'||source==='priceline')assert.equal(init.redirect,/json/i.test(init.headers?.Accept||'')?'error':'follow')
  else assert.equal(init.redirect,'manual')
  assert.equal(init.credentials,['moodyscorporation','synchronyfinancial'].includes(source)?undefined:'omit')
  if(source==='evonik'){const headers=new Headers(init.headers);for(const [name,value] of Object.entries(p.requestHeaders))assert.equal(headers.get(name),value);assert.equal(headers.has('authorization'),false);assert.equal(headers.has('cookie'),false)}
  calls.push({url,method:init.method||'GET',body:init.body||null,status:denied?403:p.status,bodySHA256:p.bodySHA256})
  const response=new Response(denied?'Forbidden':p.bytes,{status:denied?403:p.status,headers:denied?{'content-type':'text/html'}:{...(p.headers||{'content-type':p.contentType}),...(p.location?{location:p.location}:{})}})
  Object.defineProperty(response,'url',{value:denied?url:p.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 return{fixture,rows,calls,fetchImpl}
}
export async function assertSpecializedBatchExtraction(t,provider){
 if(provider.source==='bigeye')return assertBigeyeGemContract(t,provider)
 if(provider.source==='jabil')return assertJabilCurrentExtraction(t,provider)
 if(provider.source==='adityabirlarealestate')return assertAdityaBirlaRealEstatePartialExtraction(t,provider)
 if(provider.source==='reuters')return assertReutersCurrentExtraction(t,provider)
 if(provider.source==='ferrero')return assertFerreroCurrentLifecycleHolds(t,provider)
 if(provider.source==='bilt')return assertBiltCurrentForeignExtraction(t,provider)
 if(provider.source==='ikea')return assertIkeaCurrentExtraction(t,provider)
 if(provider.source==='ncs')return assertNCSControlledExtraction(t,provider)
 if(provider.source==='xerox')return assertXeroxCurrentExtraction(t,provider)
 if(provider.source==='2u')return assertTwoUPublicExtraction(t,provider)
 const source=provider.source,spec=specs[source==='moodys'?'moodyscorporation':source],io=currentTransport(t,source)
 assert.ok(specializedBatchSources.has(source))
 const jobs=await createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,minIntervalMs:0,requestIntervalMs:0,now:()=>spec.now})
 assert.equal(jobs.length,spec.count,source+' actual complete India roles')
 assert.equal(io.calls.length,spec.reads,source+' full registered native workflow')
 for(const job of jobs){
  assert.equal(job.source,source);assert.equal(job.country,'India');assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceListingComplete,false)
  assert.ok((job.sourceDescription||job.jobDescription).length>100)
  assert.equal(job.applicationVisited??false,false)
  assert.ok(job.nativeHiringOrganization?.name||job.companyName)
 }
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 if(source==='aecom'||source==='aecomindia'){
  assert.equal(readSourceObservationEvidence(jobs,source).observedRecordCount,380)
  const oracle=io.fixture.independentOracle.wholeRoleModels
  assert.deepEqual(jobs.map(j=>j.jobId),oracle.map(o=>o.guid))
  for(let i=0;i<jobs.length;i++){assert.deepEqual(jobs[i].nativeSourceRecord.detail,oracle[i].model);assert.deepEqual(jobs[i].nativeClosingRecord.detail,oracle[i].model);assert.equal(jobs[i].sourceDescription,oracle[i].model.html_description);assert.equal(jobs[i].requisitionId,oracle[i].model.reqid)}
 }else if(source==='corteva'){
  assert.equal(readSourceObservationEvidence(jobs,source).observedRecordCount,2)
  assert.deepEqual(jobs.map(j=>j.jobId),io.fixture.independentOracle.IndiaRoleIDs)
  for(const j of jobs){const o=io.fixture.independentOracle.roles[j.jobId];assert.deepEqual(j.nativeSourceRecord.detail,o.envelope);assert.deepEqual(j.nativeClosingRecord.detail,o.envelope);assert.equal(j.jobDescription,o.renderedText);assert.equal(j.sourceDescription,o.envelope.data.jobDescription);assert.equal(j.sourceUrl,o.canonical)}
 }else if(source==='corning'){
  assert.deepEqual(jobs.map(j=>j.jobId).sort(),[...io.fixture.expectedIds].sort())
  assert.ok(jobs.every(j=>j.nativeHiringOrganization.name==='Corning'&&j.applyUrl.startsWith('https://careers.corning.com/us/en/job/')))
 }else if(source==='priceline'){
  assert.deepEqual(jobs.map(j=>j.jobId).sort(),[...io.fixture.expectedIndiaIds].sort())
  for(const j of jobs){assert.equal(j.nativeHiringOrganization.name,'Priceline Technology India LLP');assert.equal(j.sourceDescription,j.nativeSourceRecord.jobPostingInfo.jobDescription);assert.equal(j.nativeClosingSourceRecord.jobPostingInfo.jobDescription,j.sourceDescription);assert.equal(j.sourceNativeClosingContext.eachFullRoleRechecked,true)}
 }else if(source==='moodyscorporation'||source==='moodys'){
  assert.deepEqual(jobs.map(j=>j.jobId).sort(),[...io.fixture.expectedIndiaIds].sort())
  for(const j of jobs){assert.equal(j.nativeHiringOrganization.name,"Moody's");assert.equal(j.sourceDescription,j.nativeSourceRecord.description);assert.equal(j.sourceDescription,j.nativeClosingSourceRecord.description);assert.equal(j.nativeTalentbrewEvidence.fullCriteriaVisibleExact,true);assert.equal(j.nativeTalentbrewEvidence.roleClosingConfirmed,true);assert.equal(j.nativeTalentbrewEvidence.listingClosingConfirmed,true)}
 }else if(source==='synchronyfinancial'){
  assert.deepEqual(jobs.map(j=>j.jobId).sort(),[...io.fixture.expectedIndiaIds].sort())
  assert.deepEqual(jobs.map(j=>j.nativeTalentbrewEvidence.publishedId).sort(),[...io.fixture.expectedPublishedIds].sort())
  for(const j of jobs){assert.equal(j.nativeHiringOrganization.name,'Synchrony Financial');assert.equal(j.sourceDescription,j.nativeSourceRecord.description);assert.equal(j.sourceDescription,j.nativeClosingSourceRecord.description);assert.equal(j.nativeTalentbrewEvidence.fullCriteriaVisibleExact,true);assert.equal(j.nativeTalentbrewEvidence.roleClosingConfirmed,true);assert.equal(j.nativeTalentbrewEvidence.listingClosingConfirmed,true);assert.equal(j.nativeTalentbrewEvidence.applicationContext.employerAccount,'synchronyfinancial/careers')}
 }else if(source==='evonik'){
  assert.deepEqual(jobs.map(j=>j.jobId).sort(),[...io.fixture.expectedIndiaIds].sort())
  assert.deepEqual(io.calls.map(p=>p.bodySHA256),io.fixture.requests.map(p=>p.bodySHA256))
  assert.equal(readSourceObservationEvidence(jobs,source).observedVacancyCount,8)
  const audit=jobs.nativeCollectionEvidence,oracle=io.fixture.independentOracle
  assert.equal(audit.heldNativeRows.length,1);assert.equal(audit.heldNativeRows[0].id,'R51735')
  assert.equal(audit.heldNativeRows[0].ownOpeningRecord.title,'Head - AMC Production')
  assert.equal(audit.heldNativeRows[0].nativeOpeningRecord.jobPostingInfo.title,'Manager / Senior Manager - AMC Production')
  assert.deepEqual(audit.heldNativeRows[0].qualificationIssues,['JobPosting:native-title-date-or-full-criteria-contradiction'])
  assert.equal(audit.observedNativeIndiaFacet.count,8);assert.equal(audit.wholeObservedIndiaFacetClosingReconciled,true)
  assert.deepEqual(audit.nativeOpeningIndiaListing.jobPostings,audit.nativeClosingIndiaListing.jobPostings)
  assert.equal(audit.observations.filter(o=>o.additionalLocationCountryScopeUnresolved).length,3)
  assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
  for(const j of jobs){assert.deepEqual(j.nativeSourceRecord,oracle.ownOpening[j.jobId]);assert.deepEqual(j.nativeClosingSourceRecord,oracle.ownClosing[j.jobId]);assert.deepEqual(j.nativeWorkdayRecord,oracle.nativeOpening[j.jobId]);assert.deepEqual(j.nativeClosingWorkdayRecord,oracle.nativeClosing[j.jobId]);assert.equal(j.sourceDescription,oracle.ownOpening[j.jobId].description);assert.equal(j.sourceDescription,oracle.nativeOpening[j.jobId].jobPostingInfo.jobDescription);assert.equal(j.nativeHiringOrganization.name,'Evonik');assert.equal(j.nativeSourceRecord.jobLocation[0].address.addressCountry,'India');assert.equal(j.nativeEvonikEvidence.primaryCountryCode,'IN');assert.equal(j.nativeEvonikEvidence.fullCriteriaVisibleExact,true);assert.equal(j.nativeEvonikEvidence.openingClosingReconciled,true);assert.equal(j.nativeEvonikEvidence.ownNativeApplyParity,true)}
 }else if(source==='stantec'){
  assert.equal(readSourceObservationEvidence(jobs,source).observedRecordCount,58)
  assert.equal(readSourceObservationEvidence(jobs,source).observedVacancyCount,55)
  for(const j of jobs){const o=io.fixture.independentOracle.roles[j.jobId];assert.ok(o&&!o.prospective);assert.deepEqual(j.nativeSourceRecord.detail,o.model);assert.deepEqual(j.nativeClosingRecord.detail,o.model);assert.equal(j.jobDescription,o.renderedText);assert.equal(j.sourceDescription,o.model.html_description);assert.equal(j.requisitionId,o.model.reqid)}
 }else{
  assert.ok(jobs.every(j=>j.sourceDetailComplete&&j.nativeRoleClosingReconciled),source)
  for(const j of jobs){
   if(source==='adidas'||source==='mannhummel'){assert.equal(j.sourceDescription,j.nativeSourceRecord.role.criteriaText);assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord);assert.equal(j.requisitionId,null)}
   if(source==='lyrahealth'){assert.equal(j.postingDate,j.nativeSourceRecord.jobPosting.datePosted);assert.ok(io.rows.some(p=>p.requestedURL.includes('/v0/postings/')&&JSON.parse(p.bytes).some(r=>r.id===j.jobId)));assert.equal(j.requisitionId,null)}
   if(source==='unosecur'){assert.equal(j.sourceDescription,j.nativeSourceRecord.api.data.requisition.job_description);assert.equal(j.jobDescription,j.sourceDescription);assert.equal(j.requisitionId,null)}
   if(source==='kkr'||source==='precisely'){assert.deepEqual(j.nativeSourceRecord.job,j.nativeClosingRecord.job);assert.equal(j.nativeSourceRecord.job.id,Number(j.jobId));assert.equal(j.sourceDescription,j.jobDescription)}
  }
 }
 return{jobs,calls:io.calls}
}
export async function assertSpecializedBatchDenial(t,provider){
 if(provider.source==='bigeye')return assertBigeyeGemDenial(t,provider)
 if(provider.source==='jabil')return assertJabilPrimaryDenial(t,provider)
 if(provider.source==='adityabirlarealestate')return assertAdityaBirlaRealEstatePrimaryDenial(t,provider)
 if(provider.source==='reuters')return assertReutersPrimaryDenial(t,provider)
 if(provider.source==='ferrero')return assertFerreroPrimaryDenial(t,provider)
 if(provider.source==='bilt')return assertBiltPrimaryDenial(t,provider)
 if(provider.source==='ikea')return assertIkeaCurrentDenial(t,provider)
 if(provider.source==='ncs')return assertNCSCurrentDenial(t,provider)
 if(provider.source==='xerox')return assertXeroxCurrentDenial(t,provider)
 if(provider.source==='2u')return assertTwoUPublicDenial(t,provider)
 const io=currentTransport(t,provider.source,true)
 await assert.rejects(()=>createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,minIntervalMs:0,requestIntervalMs:0}),error=>{
  const originals=error.nativeOriginalResponses
  assert.equal(error.status??originals?.[0]?.status,403,'The primary HTTP denial remains inspectable')
  assert.match(error.message,/HTTP.*403|403.*HTTP/i)
  if(error.inventoryEvidence){assert.equal(error.inventoryEvidence.status,'coverage-gap');assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.inventoryEvidence.listingComplete,false)}
  if(error.recruitmentObservations){assert.equal(error.recruitmentObservations.sourceScopeComplete,false);assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false);const receipts=error.recruitmentObservations.receipts??error.recruitmentObservations.responses;if(receipts){assert.equal(receipts.length,1);assert.equal(receipts[0].status,403)}}
  if(originals){assert.equal(originals.length,1);assert.equal(originals[0].status,403)}
  return true
 })
 assert.equal(io.calls.length,1,'No fallback, retry or inventory result after primary denial')
}

// Xerox current own Avature profile. The obsolete Trakstar/RSS candidate is not a positive oracle.
function xeroxCurrentFixture(){
 const bytes=readFileSync(new URL('../test-data/recruitmentGoal20261107/xerox-current.json.gz',import.meta.url))
 assert.equal(sha(bytes),'c51d8ed96fe2d4cffc95f44b62147cc1e76ffa6e84b4cfd054421d9e9b0a0c49')
 const fixture=JSON.parse(gunzipSync(bytes));assert.equal(fixture.profile,'genuine-current-20261107-full-default-154')
 for(const [hash,encoded]of Object.entries(fixture.entities))assert.equal(sha(Buffer.from(encoded,'base64')),hash)
 assert.equal(fixture.requests.length,154)
 for(const p of fixture.requests){const body=Buffer.from(fixture.entities[p.bodySHA256],'base64');assert.equal(body.length,p.bodyBytes);assert.equal(sha(body),p.bodySHA256);assert.equal(p.bodyComplete,true)}
 return fixture
}
async function assertXeroxCurrentExtraction(t,provider){
 const fixture=xeroxCurrentFixture(),calls=[]
 const fetchImpl=async(input,init={})=>{
  const p=fixture.requests[calls.length];assert.ok(p,'Xerox network tripwire: extra request');assert.equal(String(input),p.url)
  assert.equal(init.method||'GET',p.method);assert.equal(init.body,undefined);assert.equal(init.redirect,p.redirect);assert.equal(init.credentials,p.credentials)
  const h=new Headers(init.headers);assert.equal(h.get('accept'),p.requestHeaders.accept);assert.equal(h.get('user-agent'),p.requestHeaders['user-agent']);assert.equal(h.has('authorization'),false);assert.equal(h.has('cookie'),false)
  calls.push({url:String(input),method:init.method||'GET',bodySHA256:p.bodySHA256})
  const response=new Response(Buffer.from(fixture.entities[p.bodySHA256],'base64'),{status:p.status,headers:{'content-type':p.contentType}});Object.defineProperty(response,'url',{value:p.finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const jobs=await createCatalogScraper(provider).run({now:()=>fixture.observedAt})
 assert.equal(calls.length,154);assert.deepEqual(calls.map(p=>p.bodySHA256),fixture.requests.map(p=>p.bodySHA256));assert.deepEqual(jobs,fixture.expectedJobs)
 assert.deepEqual(readInventoryEvidence(jobs),fixture.expectedInventory);assert.deepEqual(readSourceObservationEvidence(jobs,'xerox'),fixture.expectedObservations);assert.equal(Object.isFrozen(readSourceObservationEvidence(jobs,'xerox')),true)
 const audit=jobs.nativeCollectionEvidence;assert.deepEqual(audit,fixture.expectedAudit);assert.equal(audit.opening.rows.length,299);assert.deepEqual(audit.opening.rows,audit.closing.rows)
 assert.equal(audit.opening.pages.length,60);assert.equal(audit.closing.pages.length,60);assert.equal(audit.openingDetails.length,16);assert.equal(audit.closingDetails.length,16)
 assert.equal(jobs.length,15);assert.deepEqual(audit.heldIndiaRoles.map(r=>r.id),['44959']);assert.equal(audit.heldIndiaRoles[0].nativeRole.criteriaText,'This role is intended to convert existing Xerox contract workers. #LI-DNI');assert.equal(audit.heldIndiaRoles[0].nativeRole.postedDate,'2023-02-14')
 assert.equal(jobs.find(j=>j.jobId==='52603').city,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.sourceNativeRecord.employer,'Xerox Holdings Corporation');assert.equal(job.sourceDetailComplete,true);assert.equal(job.postingDate,job.sourceNativeRecord.postedDate);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.applicationVisited??false,false)}
 return{jobs,calls}
}
async function assertXeroxCurrentDenial(t,provider){
 let calls=0
 const fetchImpl=async(input,init={})=>{calls++;assert.equal(String(input),'https://www.xerox.com/en-us/jobs');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(input)});return response}
 t.mock.method(globalThis,'fetch',fetchImpl)
 await assert.rejects(createCatalogScraper(provider).run(),error=>{assert.equal(error.status,403);assert.equal(error.cause.status,403);assert.match(error.message,/HTTP.*403|403.*HTTP/i);assert.equal(error.abortRetries,true);assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.recruitmentObservations.sourceScopeComplete,false);assert.equal(error.recruitmentObservations.companyIndiaZeroProven,false);assert.equal(error.recruitmentObservations.receipts.length,1);assert.equal(error.recruitmentObservations.receipts[0].status,403);assert.equal(error.recruitmentObservations.receipts[0].bodySHA256,sha('Forbidden'));return true})
 assert.equal(calls,1)
}
