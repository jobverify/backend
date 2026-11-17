import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {run} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
const compressed=fs.readFileSync(new URL('./test-data/current-20261117.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(compressed))
const profile=JSON.parse(fs.readFileSync(new URL('./reviewedNative20261117.json',import.meta.url)))
assert.equal(createHash('sha256').update(compressed).digest('hex'),profile.fixtureSHA256)
function replay(t,change=(body)=>body,identityMap=null){
 let clock=0;t.mock.method(performance,'now',()=>clock)
 const calls=[],seen=new Map()
 const fetchImpl=async(url,init={})=>{
  init.signal?.throwIfAborted();const method=init.method??'GET',requestBody=init.body??null,key=method+' '+url+' '+requestBody,count=seen.get(key)??0;seen.set(key,count+1)
  const original=v=>identityMap&&typeof v==='string'?v.replaceAll(identityMap.current,identityMap.captured):v
  const p=fixture.originals.filter(p=>p.requestedURL===original(url)&&p.method===method&&p.requestBody===original(requestBody))[count]
  assert.ok(p,'No undeclared original Fireflies request '+method+' '+url);calls.push({url,method,requestBody,count});clock+=500
  const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(bytes.length,p.bodyBytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256)
  const changed=change(bytes.toString(),{url,method,count,requestBody}),packet=typeof changed==='string'?{body:changed}:changed,response=new Response(packet.body,{status:packet.status??p.status,headers:packet.headers??p.headers})
  const finalURL=identityMap?p.finalURL.replaceAll(identityMap.captured,identityMap.current):p.finalURL
  Object.defineProperty(response,'url',{value:packet.finalURL??finalURL});return response
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 return{calls,options:{fetchImpl,now:()=>fixture.completedAt}}
}
test('current Fireflies employer handoff and complete Gem criteria/questions close30 originals and retain two explicit India roles with scope held',async t=>{
 const io=replay(t),jobs=await run(io.options)
 assert.equal(io.calls.length,30);assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),profile.roles.map(r=>r.request.variables.extId).sort())
 for(const job of jobs){
  const role=profile.roles.find(r=>r.request.variables.extId===job.jobId),d=role.model.data.oatsExternalJobPosting
  assert.deepEqual(job.sourceNativeDetail,role.model.data)
  assert.deepEqual(job.sourceNativeClosingDetail,role.model.data)
  assert.equal(job.sourceDescriptionHTML,d.descriptionHtml)
  assert.equal(job.country,'India');assert.equal(job.city,null)
  assert.equal(job.sourceRenderedCriteriaComplete,false);assert.equal(job.activationVerified,false)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  assert.ok(job.sourceNativeWorksites.some(l=>l.isoCountry==='IND')&&job.sourceNativeWorksites.some(l=>l.isoCountry!=='IND'))
  for(const p of job.sourceNativePublicPages){assert.ok(p.head.metas.every(m=>(m.name??m.property)!=='csp-nonce'));assert.ok(p.head.metas.some(m=>m.name==='description'&&m.content.length>=300));assert.ok(p.head.metas.some(m=>m.property==='og:url'&&m.content===job.sourceUrl))}
 }
 assert.equal(jobs.nativeCollectionEvidence.nativeModelsClosingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.unhydratedNativeRecordCount,6)
 assert.equal(readSourceObservationEvidence(jobs,'firefliesai').observedRecordCount,8)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition({source:'firefliesai'},jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,8);assert.equal(assessment.indiaJobs,2);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
for(const [label,edit]of[
 ['own employer',d=>d.oatsExternalJobPosting.job.teamDisplayName='Other employer'],
 ['country',d=>d.oatsExternalJobPosting.locations[0].isoCountry='CAN'],
 ['criteria',d=>d.oatsExternalJobPosting.descriptionHtml+='<p>New mandatory licence.</p>'],
 ['screening question',d=>d.oatsJobPostFieldsAndQuestions.questions.push({text:'New mandatory licence',isRequired:true})],
 ['application hidden',d=>d.oatsExternalJobPosting.isApplicationFormHidden=true],
 ['unlisted',d=>d.oatsExternalJobPosting.isUnlistedExternally=true],
 ['unknown field',d=>d.oatsExternalJobPosting.futureRequirement='New condition'],
])test('Fireflies holds closing '+label+' drift in the complete own native model',async t=>{
 const io=replay(t,(body,c)=>{if(c.method!=='POST'||c.count!==1||JSON.parse(c.requestBody).operationName!=='ExternalJobPosting')return body;const m=JSON.parse(body);edit(m.data);return JSON.stringify(m)})
 await assert.rejects(run(io.options),/Fireflies|native|model|changed/i)
})
test('Fireflies rejects changed public application HTML and current published client programs',async t=>{
 for(const target of [profile.publicPages[1].url,profile.clients[0].url]){
  const io=replay(t,(body,c)=>c.url===target?body+'<p>Unreviewed native condition.</p>':body)
  await assert.rejects(run(io.options),/Fireflies|native|changed/i)
 }
})
test('Fireflies caller cap still closes the whole reviewed native cohort',async t=>{
 const io=replay(t),jobs=await run({...io.options,maxJobs:1})
 assert.equal(jobs.length,1);assert.equal(io.calls.length,30)
 assert.equal(readSourceObservationEvidence(jobs,'firefliesai').observedRecordCount,8)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Fireflies preserves opaque pre-aborted cancellation without reads',async t=>{
 const io=replay(t),control=new AbortController(),reason=Object.freeze({caller:'stop'});control.abort(reason)
 await assert.rejects(run({...io.options,signal:control.signal}),error=>error===reason);assert.equal(io.calls.length,0)
})
test('Fireflies consumes current typed native records without freezing the captured eight-role count',async t=>{
 const io=replay(t,(body,c)=>{
  if(c.method!=='POST'||JSON.parse(c.requestBody).operationName!=='JobBoardList')return body
  const model=JSON.parse(body);model.data.oatsExternalJobPostings.jobPostings.shift();return JSON.stringify(model)
 })
 const jobs=await run(io.options)
 assert.equal(jobs.length,2);assert.equal(io.calls.length,30)
 assert.equal(readSourceObservationEvidence(jobs,'firefliesai').observedRecordCount,7)
 assert.equal(jobs.nativeCollectionEvidence.unhydratedNativeRecordCount,5)
})
test('Fireflies reconciles an actual current native India subset without a frozen selected-role cohort',async t=>{
 const excluded=profile.roles[1].request.variables.extId
 const io=replay(t,(body,c)=>{
  if(c.method!=='POST'||JSON.parse(c.requestBody).operationName!=='JobBoardList')return body
  const model=JSON.parse(body);model.data.oatsExternalJobPostings.jobPostings=model.data.oatsExternalJobPostings.jobPostings.filter(r=>r.extId!==excluded);return JSON.stringify(model)
 })
 const jobs=await run(io.options)
 assert.equal(jobs.length,1);assert.equal(io.calls.length,24)
 assert.equal(readSourceObservationEvidence(jobs,'firefliesai').observedRecordCount,7)
 assert.equal(jobs.nativeCollectionEvidence.unhydratedNativeRecordCount,6)
})
test('Fireflies binds a new typed listing-native external identity through own details and public pages without fixture role-ID admission',async t=>{
 // Synthetic identity mutation of an otherwise complete captured current role;
 // proves data admission, and does not claim a third real-world vacancy.
 const captured=profile.roles[0].request.variables.extId,current='am9icG9zdDqReviewedDynamicIdentity99'
 const io=replay(t,body=>body.replaceAll(captured,current),{captured,current}),jobs=await run(io.options)
 assert.equal(jobs.length,2);assert.equal(io.calls.length,30)
 assert.ok(jobs.some(j=>j.jobId===current&&j.sourceUrl.endsWith('/'+current)))
 assert.equal(readSourceObservationEvidence(jobs,'firefliesai').observedRecordCount,8)
})
for(const [status,challenge,kind]of[[429,false,'blocked_or_access_denied'],[202,false,'upstream_response_pending'],[202,true,'blocked_or_access_denied'],[200,true,'blocked_or_access_denied']])test('Fireflies retains native HTTP '+status+(challenge?' access challenge':'')+' classification before parsing',async t=>{
 const io=replay(t,(body,c)=>c.url==='https://fireflies.ai/'?{body:'<html>Current access challenge/pending</html>',status,headers:{'content-type':'text/html',...(challenge?{'cf-mitigated':'challenge'}:{})}}:body)
 await assert.rejects(run(io.options),error=>{assert.equal(error.status,status);assert.equal(error.httpStatus,status);assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(classifyScraperError(error).failureKind,kind);return true})
 assert.equal(io.calls.length,1)
})
test('Fireflies keeps exact original HTTP URL identity hard even on access denial',async t=>{
 const io=replay(t,(body,c)=>c.url==='https://fireflies.ai/'?{body,status:429,finalURL:'https://other.example/'}:body)
 await assert.rejects(run(io.options),error=>{assert.equal(error.httpStatus,429);assert.equal(classifyScraperError(error).failureKind,'parser_or_contract_error');assert.equal(error.softFailure,false);return true})
 assert.equal(io.calls.length,1)
})
test('Fireflies never infers India from a bare native city after explicit country is removed',async t=>{
 const io=replay(t,(body,c)=>{
  if(c.method!=='POST'||JSON.parse(c.requestBody).operationName!=='JobBoardList')return body
  const model=JSON.parse(body);for(const r of model.data.oatsExternalJobPostings.jobPostings)for(const l of r.locations)if(l.isoCountry==='IND')l.isoCountry=null
  return JSON.stringify(model)
 }),jobs=await run(io.options)
 assert.equal(jobs.length,0);assert.equal(io.calls.length,18);assert.equal(readSourceObservationEvidence(jobs,'firefliesai').observedRecordCount,8);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Fireflies aborts an in-flight original read with the opaque caller reason and disposes the late response',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'opaque-stop'});let resolveRead,cancelled=false
 const work=run({signal:controller.signal,fetchImpl:()=>new Promise(resolve=>{resolveRead=resolve;queueMicrotask(()=>controller.abort(reason))})})
 await assert.rejects(work,error=>error===reason)
 const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{status:200,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://fireflies.ai/'})
 resolveRead(response);await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true)
})
for(const [status,expectedKind]of[[403,'blocked_or_access_denied'],[429,'blocked_or_access_denied'],[202,'upstream_response_pending']])test('Fireflies retains already-observed HTTP '+status+' when request deadline interrupts stalled denial disposal',async()=>{
 let reads=0,cancellations=0
 const fetchImpl=async url=>{reads++;const response=new Response(new ReadableStream({cancel(){cancellations++;return new Promise(()=>{})}}),{status,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}
 await assert.rejects(run({fetchImpl,requestTimeoutMs:20}),error=>{assert.equal(error.httpStatus,status);assert.equal(classifyScraperError(error).failureKind,expectedKind);return true})
 assert.equal(reads,1);assert.ok(cancellations>=1)
})
test('Fireflies explicit caller abort still owns opaque reason during denied-response disposal',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'stop-denial-disposal'})
 const fetchImpl=async url=>{const response=new Response(new ReadableStream({cancel(){queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})}}),{status:429,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response}
 await assert.rejects(run({fetchImpl,requestTimeoutMs:100,signal:controller.signal}),error=>error===reason)
})
