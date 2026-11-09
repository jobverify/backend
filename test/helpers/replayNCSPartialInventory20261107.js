import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const sha=b=>createHash('sha256').update(b).digest('hex')
const USER_AGENT='Mozilla/5.0 (compatible; Jobverify careers inventory check)'
let cached
function fixture(){
 if(cached)return cached
 const compressed=readFileSync(new URL('../test-data/recruitmentGoal20261107/ncs-partial-controlled.json.gz',import.meta.url))
 assert.equal(sha(compressed),'f58da9400ed50c547599df2f5dd4983864f33a8399485550c397c6f47f6348cd')
 const value=JSON.parse(gunzipSync(compressed))
 assert.equal(value.profile,'genuine-ncs-india-discovery90-controlled-closing-reuse-and-actual34-denial')
 assert.equal(value.sourceResolved,false);assert.equal(value.actualSuccessfulLiveClosingCapture,false);assert.equal(value.closingResponseReuse,true)
 assert.equal(value.discoveryPackets.length,90);assert.equal(value.actualFailure.requests.length,34)
 assert.deepEqual(value.qualifications.nativeFieldsIgnored,[])
 for(const[hash,encoded]of Object.entries(value.entities))assert.equal(sha(Buffer.from(encoded,'base64')),hash)
 for(const p of [...value.discoveryPackets,...value.actualFailure.requests]){const bytes=Buffer.from(value.entities[p.bodySHA256],'base64');assert.equal(bytes.length,p.bodyBytes);assert.equal(sha(bytes),p.bodySHA256)}
 cached=value;return value
}
// Only execution clocks belonging to transport receipts are normalized. No
// role, criteria, native calendar, raw row or business model field is removed.
const auditWithoutReceiptClocks=(audit,key)=>({...audit,[key]:audit[key].map(({startedAt,completedAt,...receipt})=>receipt)})
const responseFor=(f,p)=>{const response=new Response(Buffer.from(f.entities[p.bodySHA256],'base64'),{status:p.status,headers:{'content-type':p.contentType??p.responseHeaders?.['content-type']}});Object.defineProperty(response,'url',{value:p.finalURL});return response}
function assertAnonymousTransport(init){
 assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
 const headers=new Headers(init.headers);assert.equal(headers.get('user-agent'),USER_AGENT);assert.equal(headers.has('cookie'),false);assert.equal(headers.has('authorization'),false)
}
function parametersFor(init){
 if(init.body instanceof FormData)return Object.fromEntries([...init.body].map(([k,v])=>[k,k==='filterCri'?JSON.parse(v):v]))
 return init.body?JSON.parse(init.body):null
}

export async function assertNCSControlledExtraction(t,provider){
 const f=fixture(),calls=[]
 const fetchImpl=async(input,init={})=>{
  assertAnonymousTransport(init)
  const parameters=parametersFor(init),url=String(input),method=init.method??'GET'
  const p=f.discoveryPackets.find(p=>(p.requestedURL??p.url)===url&&p.method===method&&(!parameters||JSON.stringify(p.parameters)===JSON.stringify(parameters)))
  assert.ok(p,'NCS controlled discovery network tripwire: unrecorded request '+url)
  const json=url.startsWith('https://public.zwayam.com/'),script=url.endsWith('.js'),headers=new Headers(init.headers)
  assert.equal(headers.get('accept'),json?'application/json':script?'application/javascript':'text/html')
  if(method==='POST'&&!(init.body instanceof FormData))assert.equal(headers.get('content-type'),'application/json')
  calls.push({url,method,parameters,bodySHA256:p.bodySHA256})
  return responseFor(f,p)
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 const jobs=await createCatalogScraper(provider).run({fetchImpl,now:()=>f.observedAt})
 assert.equal(calls.length,180,'Controlled closing reuses all90 genuine discovery packets; this is not a live closing capture')
 assert.deepEqual(jobs,f.expectedJobs)
 assert.deepEqual(readInventoryEvidence(jobs),f.expectedInventory)
 assert.deepEqual(readSourceObservationEvidence(jobs,'ncs'),f.expectedObservations)
 assert.equal(Object.isFrozen(readSourceObservationEvidence(jobs,'ncs')),true)
 const audit=jobs.nativeCollectionEvidence
 assert.deepEqual(auditWithoutReceiptClocks(audit,'originalResponses'),auditWithoutReceiptClocks(f.expectedAudit,'originalResponses'))
 assert.equal(jobs.length,39);assert.equal(audit.observations.length,40)
 assert.deepEqual(audit.heldNativeRows.map(o=>o.id),['950039'])
 const held=audit.heldNativeRows[0]
 assert.equal(held.nativeOpeningRow._source.departmentName,'All Departments');assert.equal(held.nativeOpeningRecord.departmentName,'Corporate')
 assert.equal(held.nativeClosingRow._source.departmentName,'All Departments');assert.equal(held.nativeClosingRecord.departmentName,'Corporate')
 assert.equal(jobs.filter(j=>j.structuredCountryMissing).length,16)
 const old=jobs.find(j=>j.jobId==='941245');assert.equal(old.datePosted,'2026-05-13');assert.equal(old.nativeSourceRecord.departmentName,'Singtel Group IT')
 assert.equal(old.nativeLegalHiringOrganization,null);assert.equal(old.companyName,'NCS')
 for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.location,'Pune, Maharashtra, India');assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.applicationVisited,false);assert.equal(job.acceptingApplicationsVerified,false)}
 assert.equal(audit.wholeObservedNativeBoardClosingReconciled,true);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 return {jobs,calls,controlledClosingReuse:true,actualSuccessfulLiveClosingCapture:false,sourceResolved:false}
}

export async function assertNCSCurrentDenial(t,provider){
 const f=fixture();let primaryCalls=0
 const denied=async(input,init={})=>{primaryCalls++;assert.equal(String(input),'https://www.ncs.co/careers/');assertAnonymousTransport(init);const response=new Response('Forbidden',{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:String(input)});return response}
 t.mock.method(globalThis,'fetch',denied)
 await assert.rejects(createCatalogScraper(provider).run(),error=>{
  assert.equal(error.status,403);assert.equal(error.cause.status,403);assert.match(error.message,/HTTP 403/)
  assert.equal(classifyScraperError(error).failureKind,'blocked_or_access_denied')
  assert.equal(error.recruitmentObservations.receipts.length,1);assert.equal(error.recruitmentObservations.receipts[0].bodySHA256,sha('Forbidden'))
  assert.equal(error.recruitmentObservations.sourceScopeComplete,false);assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false);assert.equal(error.inventoryEvidence,undefined);return true
 })
 assert.equal(primaryCalls,1,'Synthetic primary denial is a separate one-read guard, not the actual34-read capture')

 // Replay the actual failure separately. Resolve each four-wide detail batch
 // in its recorded order, and release its four criteria responses only after
 // all four GETs have started, as the original HTTP timestamps demonstrate.
 const requests=f.actualFailure.requests;let index=0,activeGroup=null
 const fetchImpl=async(input,init={})=>{
  const p=requests[index++];assert.ok(p,'NCS current failure network tripwire: extra read')
  assert.equal(String(input),p.url);assert.equal(init.method,p.method);assertAnonymousTransport(init)
  assert.deepEqual(Object.fromEntries(new Headers(init.headers)),p.sourceHeaders)
  const body=init.body instanceof FormData?Object.fromEntries(init.body):init.body??null
  assert.deepEqual(body,p.body);assert.equal(init.body instanceof FormData,p.bodyKind==='form-data')
  if(p.bodyKind==='form-data'){
   const wire=Buffer.from(p.wireRequestBodyBase64,'base64');assert.equal(wire.length,p.wireRequestBodyBytes);assert.equal(sha(wire),p.wireRequestBodySHA256)
   const decoded=await new Request(p.url,{method:p.method,headers:p.wireRequestHeaders,body:wire}).formData();assert.deepEqual(Object.fromEntries(decoded),body)
  }else assert.equal(sha(Buffer.from(init.body??'')),p.wireRequestBodySHA256)
  if(p.url.endsWith('/jobs-service/v1/jobs/careersite')){
   if(!activeGroup)activeGroup={posts:[],gets:[],cursor:0}
   const group=activeGroup
   return new Promise(resolve=>{group.posts.push({packet:p,resolve});if(group.posts.length===4){const gets=requests.slice(index,index+4);assert.ok(gets.every(x=>x.method==='GET'&&x.url.includes('/getReqFieldsForCareersSite/')));group.order=gets.map(x=>Number(x.url.split('/').at(-2)));const first=group.posts.find(x=>JSON.parse(x.packet.body).jobId===group.order[0]);first.resolve(responseFor(f,first.packet))}})
  }
  if(p.url.includes('/getReqFieldsForCareersSite/')){
   const group=activeGroup;assert.ok(group)
   return new Promise(resolve=>{group.gets.push({packet:p,resolve});group.cursor++;if(group.cursor<4){const next=group.posts.find(x=>JSON.parse(x.packet.body).jobId===group.order[group.cursor]);next.resolve(responseFor(f,next.packet))}else{activeGroup=null;for(const get of group.gets)get.resolve(responseFor(f,get.packet))}})
  }
  return responseFor(f,p)
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 await assert.rejects(createCatalogScraper(provider).run(),error=>{
  assert.equal(error.status,403);assert.equal(error.cause.status,403);assert.equal(error.message,f.actualFailure.error.message)
  assert.equal(error.cause.requestUrl,'https://public.zwayam.com/requisition_service/getReqFieldsForCareersSite/950039/15955')
  assert.equal(classifyScraperError(error).failureKind,'blocked_or_access_denied')
  const audit=error.recruitmentObservations
  assert.deepEqual(auditWithoutReceiptClocks(audit,'receipts'),auditWithoutReceiptClocks(f.actualFailure.expectedAudit,'receipts'))
  assert.equal(audit.receipts.length,34);assert.equal(audit.receipts.filter(p=>p.status===403).length,4)
  assert.equal(audit.observations.length,40);assert.equal(audit.observations.filter(o=>o.nativeOpeningRecord).length,8)
  assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(error.inventoryEvidence,undefined)
  return true
 })
 assert.equal(index,34,'All34 actual packets are replayed once; no denial retry or synthetic successful closing')
 return {primaryDenialReads:primaryCalls,actualFailureReads:index,sourceResolved:false,actualSuccessfulLiveClosingCapture:false}
}
