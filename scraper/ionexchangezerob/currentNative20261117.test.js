import assert from'node:assert/strict'
import test,{before,after}from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{run}from'./script.js'
import{readSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
import{sourceLifecycleCleanupForbidden}from'../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),real=globalThis.fetch
before(()=>{globalThis.fetch=async()=>{throw Error('Real network forbidden in source regression')}});after(()=>{globalThis.fetch=real})
function replay(edit=(_p,s)=>s){const reads=[],counts=new Map();return{reads,options:{requestIntervalMs:0,fetchText:async()=>Buffer.from(fixture.responses[0].bodyBase64,'base64').toString(),fetchPage:async url=>({status:fixture.responses[0].status,url,html:Buffer.from(fixture.responses[0].bodyBase64,'base64').toString()}),fetchImpl:async(url,init)=>{const p=fixture.responses.find(p=>p.requestedURL===String(url));assert.ok(p,'Only actual native declaration '+url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');reads.push(String(url));const count=(counts.get(url)??0)+1;counts.set(url,count);const changed=edit(p,Buffer.from(p.bodyBase64??'','base64').toString(),count),r=typeof changed==='string'?{body:changed}:changed;return Object.defineProperty(new Response(r.body,{status:r.status??p.status,headers:r.headers??p.headers}),'url',{value:r.url??p.url})}}}}
test('ionexchangezerob actual current original models retain typed source observations and fail closed on unknown role eligibility and company scope',async()=>{const{reads,options}=replay();const jobs=await run(options);assert.equal(jobs.length,0);const observed=readSourceObservationEvidence(jobs,'ionexchangezerob');assert.equal(observed.recordKind,'role-areas');assert.equal(observed.observedRecordCount,10);assert.equal(observed.observedVacancyCount,0);assert.equal(observed.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);const n=jobs.nativeCollectionEvidence;assert.equal(n.nativeOpeningDetails.length,10);assert.equal(n.nativeClosingDetails.length,10);assert.equal(n.extractedDetailJobs,0);assert.equal(n.lifecycleCleanupAllowed,false);assert.equal(n.sourceScopeComplete,false);assert.equal(n.browserEquivalenceComplete,false);assert.equal(n.retainedResponses.length,reads.length);assert.equal(reads.length,fixture.responses.length*2)})
export{fixture,replay}
test('ZeroB regional cohort titles, full native requirements and actual cities remain raw without invented requisitions or India qualification',async()=>{
 const{options}=replay(),jobs=await run(options),n=jobs.nativeCollectionEvidence;assert.equal(n.nativeOpeningDetails.length,10);assert.equal(n.distinctNativeVacancyCount,null)
 for(const d of n.nativeOpeningDetails){assert.equal(d.nativeCountry,null);assert.equal(d.nativeCountryQualified,false);assert.equal(d.distinctRequisitionIdentityQualified,false);assert.equal(d.applicationCriteriaAndSubmissionQualified,false);assert.match(d.publishedNativeCriteria,/Qualifications/);assert.match(d.publishedNativeCriteria,/Frontliner|Front Liner/);assert.ok(d.currentPublication.fullNativeHTML);assert.ok(d.fullNativeMain)}
 assert.match(n.nativeOpeningDetails[0].publishedNativeCriteria,/Sangrur/);assert.equal(n.companyIndiaTotal,null);assert.equal(jobs.length,0)
})
test('ZeroB additional native role-area data flows into observations while unreviewed detail carriers stay held without requests',async()=>{
 const{reads,options}=replay((p,s)=>p.url.endsWith('/current-openings/')?s.replace('</body>','<div class="job-listing" data-id="future-native-area"><h2>SALES</h2><h3>Future Native Region</h3><a href="/future-native-native-cohort">View</a></div></body>'):s),jobs=await run(options),n=jobs.nativeCollectionEvidence
 assert.equal(readSourceObservationEvidence(jobs,'ionexchangezerob').observedRecordCount,11);assert.equal(n.nativeUnreviewedDetailCarriers.length,2);assert.ok(n.nativeOpeningRoleAreas.some(r=>r.publishedHeadings[1]==='Future Native Region'));assert.equal(reads.some(u=>u.includes('/future-native-')),false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('ZeroB differing complete closing criteria/nontext context remains unequal and held',async()=>{
 const{options}=replay((p,s,count)=>p.status===200&&p.url.includes('/sr-sales-executive-')&&count===2?s.replace('</h1>','</h1><p>New native requirements noteligible remain unchanged in raw text.</p><img src="/unread-native-criteria.png" alt="Unknown mandatory visual criterion">'):s),jobs=await run(options),n=jobs.nativeCollectionEvidence
 assert.equal(n.closingFullDetailModelsMatch,false);assert.match(n.nativeClosingDetails[0].publishedNativeCriteria,/noteligible/);assert.match(n.nativeClosingDetails[0].currentPublication.fullNativeHTML,/Unknown mandatory visual criterion/);assert.equal(jobs.length,0)
})
test('ZeroB exact active current careers/listing/detail carriers reject foreign or inactive replacements',async()=>{
 for(const mode of['home','listing','detail']){const{options}=replay((p,s)=>{
  if(p.url==='https://www.zerobonline.com/'&&mode==='home')return s.replace('href="https://www.zerobonline.com/careers/"','hidden href="https://www.zerobonline.com/careers/"')
  if(p.url.endsWith('/careers/')&&mode==='listing')return s.replaceAll('href="/current-openings/"','href="https://foreign.invalid/jobs/"')
  if(p.url.endsWith('/sr-sales-executive-in-ion-exchange-i-ltd-hws-north/')&&mode==='detail')return s.replace('rel="canonical" href="https://www.zerobonline.com/sr-sales-executive-in-ion-exchange-i-ltd-hws-north/"','rel="canonical" href="https://foreign.invalid/role/"');return s
 });await assert.rejects(run(options),e=>e.failureKind==='parser_or_contract_error',mode)}
})
test('ZeroB current source stops actual native denial and opaque/null caller cancellation without external legacy fallback',async()=>{
 const denied=replay((p,s)=>p.url.endsWith('/current-openings/')?{body:s,status:403}:s);await assert.rejects(run(denied.options),e=>e.status===403);assert.equal(denied.reads.length,3)
 for(const reason of[Object.freeze({owner:'ZeroB'}),null]){const c=new AbortController();c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{throw Error('No request after abort')}}),e=>e===reason)}
})

test('ZeroB late full-model audit attachment preserves exact frozen/null caller reason and elapsed source deadline before returning',async t=>{
 const outcomes=[]
 for(const mode of ['opaque','null','source-deadline']){
  const caller=new AbortController(),reason=mode==='null'?null:Object.freeze({owner:'ZeroB-late-native-audit'}),define=Object.defineProperty;let clock=0,triggered=false
  t.mock.method(performance,'now',()=>clock)
  t.mock.method(Object,'defineProperty',(target,key,descriptor)=>{
   const result=define(target,key,descriptor)
   if(Array.isArray(target)&&key==='nativeCollectionEvidence'&&descriptor.value?.nativeOpeningModel){triggered=true;if(mode==='source-deadline')clock=180001;else caller.abort(reason)}
   return result
  })
  const {reads,options}=replay()
  try{let caught,rejected=false;try{await run({...options,signal:caller.signal})}catch(e){caught=e;rejected=true}outcomes.push({mode,exact:rejected&&(mode==='source-deadline'?caught.name==='TimeoutError'&&caught.message==='ZeroB source deadline exceeded':caught===reason)});assert.equal(triggered,true);assert.equal(reads.length,fixture.responses.length*2)}finally{t.mock.restoreAll()}
 }
 assert.deepEqual(outcomes,['opaque','null','source-deadline'].map(mode=>({mode,exact:true})))
})
