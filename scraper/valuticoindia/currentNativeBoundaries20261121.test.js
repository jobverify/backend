import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {runCurrentValutico} from './currentNative20261121.js'
import {readCorporate,CAREERS,API_ACCOUNT} from './nativeData20261121.js'
const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-prefix-20261121.json.gz',import.meta.url))))
const packets=new Map(fixture.responses.map(p=>[p.kind,{...p,body:Buffer.from(p.bodyBase64,'base64').toString('utf8')}]))
const realCareers=packets.get('corporateCareers').body,cards=readCorporate(realCareers,CAREERS).cards
// This is an explicitly controlled one-card transaction, not an original full
// current nine-role capture. It repeats actual originals to exercise closing.
let singleCardCareers=realCareers
for(const card of cards.slice(1)){assert.ok(card.nativeCardHTML.length>0);assert.equal(singleCardCareers.split(card.nativeCardHTML).length,2);singleCardCareers=singleCardCareers.replace(card.nativeCardHTML,'')}
assert.equal(readCorporate(singleCardCareers,CAREERS).cards.length,1)
const realJob=JSON.parse(packets.get('job5856345').body)
function controlled(change=()=>null){
 const mapping=new Map([...packets].map(([kind,p])=>[kind==='account'?API_ACCOUNT:p.receipt.requestedURL,{kind,p}]))
 const counts=new Map,requests=[]
 return{requests,async fetch(url,init={}){
  url=String(url);assert.equal(init.method,'GET');assert.equal(init.credentials,'omit')
  const hit=mapping.get(url);assert.ok(hit,'No uncontrolled HTTP allowed: '+url)
  const n=(counts.get(url)??0)+1;counts.set(url,n);requests.push({url,occurrence:n})
  let body=hit.kind==='corporateCareers'?singleCardCareers:hit.p.body
  let status=200,headers=hit.p.receipt.headers
  const altered=change({url,kind:hit.kind,occurrence:n,body})
  if(altered){body=altered.body??body;status=altered.status??status;headers=altered.headers??headers}
  const response=new Response(body,{status,headers})
  Object.defineProperty(response,'url',{value:hit.kind==='account'?API_ACCOUNT:hit.p.receipt.finalURL})
  return response
 }}
}
async function attempt(change,extra={}){
 const transport=controlled(change)
 try{return{jobs:await runCurrentValutico({fetchImpl:transport.fetch,requestIntervalMs:0,...extra}),transport}}catch(error){return{error,transport}}
}
test('controlled complete one-card foreign cohort retains full DTO and never becomes company zero',async()=>{
 const {jobs,error,transport}=await attempt()
 assert.equal(error,undefined);assert.equal(jobs.length,0);assert.equal(transport.requests.length,12)
 const a=jobs.nativeCollectionEvidence
 assert.equal(a.configuredNativeCohortObserved,1);assert.equal(a.wholeNativeRoleModelsClosingReconciled,true)
 assert.deepEqual(a.nativeRoleObservations[0].nativeJob,realJob);assert.equal(a.nativeRoleObservations[0].nativeCountry,'United Kingdom')
 assert.equal(a.nativeRoleObservations[0].nativePublicationDate,'2026-06-02T00:00:00.000Z')
 assert.equal(a.nativeRoleObservations[0].sourceCountryQualifiedForIndia,false)
 assert.equal(a.companyIndiaTotal,null);assert.equal(a.companyGlobalTotal,null);assert.equal(a.lifecycleCleanupAllowed,false);assert.equal(a.sourceScopeComplete,false)
})
for(const [name,mutate]of[
 ['full authored requirements',j=>{j.requirements+='<p>Additional published eligibility.</p>'}],
 ['unreviewed authoritative field',j=>{j.additionalRequirements='New current native eligibility'}],
 ['native publication date',j=>{j.published='2026-06-03T00:00:00.000Z'}]
])test('closing change to '+name+' retains both full entities and never claims reconciliation',async()=>{
 const {error}=await attempt(({kind,occurrence,body})=>{if(kind==='job5856345'&&occurrence===2){const j=JSON.parse(body);mutate(j);return{body:JSON.stringify(j)}}})
 assert.ok(error);const a=error.nativeCollectionEvidence
 assert.equal(a.wholeNativeRoleModelsClosingReconciled,false)
 assert.deepEqual(a.opening.roles[0].nativeJob,realJob)
 assert.notDeepEqual(a.closing.roles[0].nativeJob,realJob)
 assert.equal(a.nativeRoleObservations[0].sourceRoleQualified,false);assert.equal(a.lifecycleCleanupAllowed,false)
 assert.equal(a.rawPublisherResponses.filter(r=>r.requestedURL.includes('/api/v2/')).length,2)
})
test('closing unavailable native role preserves known status and opening raw model without reconciliation',async()=>{
 const {error}=await attempt(({kind,occurrence})=>kind==='job5856345'&&occurrence===2?{status:403,body:'Access denied'}:null)
 assert.equal(error.httpStatus,403);const a=error.nativeCollectionEvidence
 assert.equal(a.wholeNativeRoleModelsClosingReconciled,false);assert.equal(a.nativeRoleObservations[0].sourceRoleQualified,false)
 assert.deepEqual(a.opening.roles[0].nativeJob,realJob);assert.equal(a.closing.roles[0].nativeJob,null)
 assert.equal(a.transport.receipts.at(-1).status,403);assert.equal(a.transport.receipts.at(-1).bodyComplete,false)
})
test('whole account application metadata closing change cannot disappear from equality',async()=>{
 const {error}=await attempt(({kind,occurrence,body})=>{if(kind==='account'&&occurrence===2){const account=JSON.parse(body);account.details.gdpr.requestApplicantConsent=false;return{body:JSON.stringify(account)}}})
 assert.ok(error);assert.equal(error.nativeCollectionEvidence.wholeNativeRoleModelsClosingReconciled,false)
 assert.notDeepEqual(error.nativeCollectionEvidence.opening.account,error.nativeCollectionEvidence.closing.account)
})
test('stable unreviewed native criteria remains full held observation, never a qualified job',async()=>{
 const {jobs,error}=await attempt(({kind,body})=>{if(kind==='job5856345'){const j=JSON.parse(body);j.additionalRequirements='Unreviewed native authored requirements';return{body:JSON.stringify(j)}}})
 assert.equal(error,undefined);assert.equal(jobs.length,0)
 const a=jobs.nativeCollectionEvidence,o=a.nativeRoleObservations[0]
 assert.equal(o.nativeJob.additionalRequirements,'Unreviewed native authored requirements');assert.ok(o.qualificationIssues.includes('unreviewed-native-fields'))
 assert.equal(o.sourceRoleQualified,false);assert.equal(a.lifecycleCleanupAllowed,false)
})
for(const reason of [Object.freeze({opaque:'final audit'}),null])for(const boundary of ['success','error'])test(boundary+' final audit retains exact '+(reason===null?'null':'frozen')+' caller reason',async()=>{
 const c=new AbortController,original=Object.defineProperty;let triggered=false,caught=Symbol()
 Object.defineProperty=function(target,key,descriptor){
  const result=original(target,key,descriptor)
  if(key==='nativeCollectionEvidence'&&((boundary==='success'&&Array.isArray(target))||(boundary==='error'&&target instanceof Error))){triggered=true;c.abort(reason)}
  return result
 }
 try{
  const t=controlled(boundary==='error'?({kind})=>kind==='corporateRoot'?{status:403,body:'Denied'}:null:undefined)
  try{await runCurrentValutico({fetchImpl:t.fetch,requestIntervalMs:0,signal:c.signal})}catch(e){caught=e}
 }finally{Object.defineProperty=original}
 assert.equal(triggered,true);assert.equal(caught,reason)
})
for(const reason of [Object.freeze({opaque:'final close'}),null])for(const boundary of ['success','error'])test(boundary+' final close retains exact '+(reason===null?'null':'frozen')+' caller reason',async()=>{
 const c=new AbortController,original=AbortController.prototype.abort;let triggered=false,caught=Symbol()
 AbortController.prototype.abort=function(value){if(value?.message==='Valutico reader closed deadline exceeded'&&!triggered){triggered=true;original.call(c,reason)}return original.call(this,value)}
 try{
  const t=controlled(boundary==='error'?({kind})=>kind==='corporateRoot'?{status:403,body:'Denied'}:null:undefined)
  try{await runCurrentValutico({fetchImpl:t.fetch,requestIntervalMs:0,signal:c.signal})}catch(e){caught=e}
 }finally{AbortController.prototype.abort=original}
 assert.equal(triggered,true);assert.equal(caught,reason)
})

const syntheticIndia=({kind,body})=>{
 if(kind==='corporateCareers')return{body:body.replace(cards[0].countries.join(', '),'India')}
 if(kind==='job5856345'){const j=JSON.parse(body);j.location={city:'',country:'India',countryCode:'IN',region:null};j.locations=[{...j.location,hidden:false}];return{body:JSON.stringify(j)}}
 return null
}
test('counterfactual published India country fields qualify only the exact bound complete native role',async()=>{
 const {jobs,error}=await attempt(syntheticIndia);assert.equal(error,undefined);assert.equal(jobs.length,1)
 const j=jobs[0];assert.equal(j.company,'Valutico');assert.equal(j.country,'India');assert.equal(j.sourceNativeJob.location.country,'India')
 assert.equal(j.postingDate,'2026-06-02T00:00:00.000Z');assert.equal(j.activeApplyVerified,false)
 for(const key of ['description','requirements','benefits'])assert.ok(j.jobDescription.includes(realJob[key]))
 assert.equal(j.applyUrl,cards[0].legacyURL);assert.equal(j.sourceUrl,'https://apply.workable.com/valutico-2/j/720E76FE8A')
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})
test('unbound corporate applicant eligibility is retained as a concrete per-role qualification hold',async()=>{
 const {jobs,error}=await attempt(row=>{
  const result=syntheticIndia(row)
  if(row.kind==='corporateCareers')return{body:result.body+'<p>Applicants must hold the specified work permit.</p>'}
  return result
 })
 assert.equal(error,undefined);assert.equal(jobs.length,0)
 const o=jobs.nativeCollectionEvidence.nativeRoleObservations[0]
 assert.ok(o.qualificationIssues.includes('unbound-corporate-eligibility'));assert.ok(o.unboundCorporateEligibility.some(v=>v.includes('work permit')))
 assert.equal(o.nativeJob.location.country,'India');assert.equal(o.sourceRoleQualified,false)
})
for(const http of [false,true])test((http?'known HTTP priority':'late synchronous failed-audit')+' after audit attachment uses the final source clock',async()=>{
 const baseline=await attempt(({kind})=>kind==='corporateRoot'?(http?{status:403,body:'Denied'}:{body:'<html><title>Unbound publisher</title></html>'}):null,{sourceTimeoutMs:1000})
 if(http)assert.equal(baseline.error.httpStatus,403);else assert.equal(baseline.error.code,'VALUTICO_CURRENT_HOLD')
 const original=Object.defineProperty,clockDescriptor=Object.getOwnPropertyDescriptor(performance,'now'),realNow=performance.now.bind(performance)
 let jumped=0,once=false,caught
 original(performance,'now',{value:()=>realNow()+jumped,configurable:true})
 Object.defineProperty=function(target,key,descriptor){
  const result=original(target,key,descriptor)
  if(target instanceof Error&&key==='nativeCollectionEvidence'&&!once){once=true;jumped=2000}
  return result
 }
 try{
  const t=controlled(({kind})=>kind==='corporateRoot'?(http?{status:403,body:'Denied'}:{body:'<html><title>Unbound publisher</title></html>'}):null)
  try{await runCurrentValutico({fetchImpl:t.fetch,requestIntervalMs:0,sourceTimeoutMs:1000})}catch(e){caught=e}
 }finally{Object.defineProperty=original;if(clockDescriptor)original(performance,'now',clockDescriptor);else delete performance.now}
 assert.equal(once,true);if(http)assert.equal(caught?.httpStatus,403);else assert.equal(caught?.name,'TimeoutError')
})

test('counterfactual one-card India model never emits object requisition code',async()=>{
 // Explicit country changes are controlled output plumbing, not native India evidence.
 const withCode=code=>attempt(({kind,body})=>{
  if(kind==='corporateCareers')return{body:body.replace(cards[0].countries.join(', '),'India')}
  if(kind==='job5856345'){
   const native=JSON.parse(body);native.location={city:'Bangalore',country:'India',countryCode:'IN',region:null}
   native.locations=[{...native.location,hidden:false}];native.code=code
   return{body:JSON.stringify(native)}
  }
 })
 const baseline=await withCode(null);assert.equal(baseline.error,undefined);assert.equal(baseline.jobs.length,1);assert.equal(baseline.jobs[0].requisitionId,null)
 const invalid=await withCode({});assert.equal(invalid.error,undefined)
 assert.equal(invalid.jobs.length,0)
 const evidence=invalid.jobs.nativeCollectionEvidence,observation=evidence.nativeRoleObservations[0]
 assert.deepEqual(observation.nativeJob.code,{})
 assert.equal(observation.nativePublicationDate,realJob.published)
 assert.equal(observation.sourceRoleQualified,false);assert.ok(observation.qualificationIssues.includes('unqualified-native-requisition-code'))
 assert.equal(evidence.wholeNativeRoleModelsClosingReconciled,true);assert.equal(evidence.lifecycleCleanupAllowed,false)
})
