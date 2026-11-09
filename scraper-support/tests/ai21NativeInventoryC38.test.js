import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'

import {createHash} from 'node:crypto'
import net from 'node:net'
import tls from 'node:tls'
import http from 'node:http'
import https from 'node:https'
import {run} from '../../scraper/ai21labs/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
const F=new URL('../../scraper/ai21labs/fixtures/',import.meta.url)
const hash=value=>createHash('sha256').update(value).digest('hex'),ROOT='https://www.ai21.com/careers/'
const packets=new Map(),provenance=JSON.parse(fs.readFileSync(new URL('provenance.json',F)))
for(const derived of provenance.records){
 const bytes=fs.readFileSync(new URL(derived.file,F));assert.equal(hash(bytes),derived.derivedBodySHA256)
 const record={...derived,requestedUrl:derived.url,finalUrl:derived.url,sha256:derived.derivedBodySHA256,headers:{'content-type':derived.contentType}}
 packets.set(derived.url,{record,bytes})
}
const roles=[
 {id:'CC.372',title:'Deep Learning Engineer',url:ROOT+'deep-learning-engineer/CC.372/',criteriaSHA256:'ac5c468f1fc7b2cd26063ec0ee09a6ce66366d72701f185d5c5baf8fd5737e02'},
 {id:'95.47D',title:'Technical Project Manager – Post training',url:ROOT+'technical-project-manager-post-training/95.47D/',criteriaSHA256:'fd561bbf7c4ab34fc0c9c8d447f969f034b26fb0da55fcbdac1189cce5336a38'},
 {id:'95.47C',title:'Senior Marketing Designer',url:ROOT+'senior-marketing-designer/95.47C/',criteriaSHA256:'abb4ac8a3a856b152e636a55aa80b6367884666accb83c122e44b277a608a52c'},
]
function offline(t,mutate=()=>{}){
 const network=[],calls=[];const forbidden=()=>{network.push('blocked');throw Error('External network forbidden')}
 for(const[target,keys]of[[globalThis,['fetch']],[net,['connect','createConnection']],[tls,['connect']],[http,['request','get']],[https,['request','get']]])for(const key of keys)t.mock.method(target,key,forbidden)
 const options={maxRequests:4,now:()=> '2026-11-07T07:51:35.851Z',fetchImpl:async(url,init)=>{
  calls.push(url);assert.equal(init.method,'GET');init.signal.throwIfAborted()
  assert.ok(packets.has(url),'undeclared/offline input: '+url)
  const{record,bytes}=packets.get(url),packet={url:record.finalUrl,status:record.status,body:bytes.toString('utf8'),contentType:record.contentType};mutate(packet)
  const response=new Response(packet.body,{status:packet.status,headers:{...record.headers,'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.url});Object.defineProperty(response,'sourceCapture',{value:{sourceRequestedAt:record.sourceRequestedAt,sourceCompletedAt:record.sourceCompletedAt,bodySHA256:record.sha256}})
  return response
 }}
 return{options,calls,network}
}
// Credential-free derived fixtures catch the confirmed generic parser loss of native
// role sections. Country eligibility and source completeness remain separate.
test('AI21 credential-free native fixtures retain full criteria with three unknown-country observations',async t=>{
 const fixture=offline(t),jobs=await run(fixture.options),audit=jobs.sourceAudit
 assert.equal(jobs.length,0)
 assert.deepEqual(readSourceObservationEvidence(jobs,'ai21labs'),{source:'ai21labs',recordKind:'vacancy-rows',observedRecordCount:3,observedVacancyCount:3,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(audit.nativeObservations.length,3)
 for(const[index,expected]of roles.entries()){
  const fact=audit.nativeObservations[index]
  assert.equal(fact.id,expected.id);assert.equal(fact.title,expected.title);assert.equal(fact.url,expected.url)
  assert.equal(fact.country,null);assert.equal(fact.legalEmployer,null);assert.equal(fact.postingDate,null);assert.equal(fact.closingDate,null)
  assert.equal(fact.location,'Tel Aviv-Yafo');assert.equal(fact.employmentType,'Full-time')
  assert.equal(fact.sourceDetailComplete,true)
  assert.deepEqual(fact.sections.map(s=>s.heading),['Description','Role and Responsibilities','Requirements','About Us'])
  assert.equal(hash(fact.sections[2].text),expected.criteriaSHA256)
  assert.equal(fact.criteria.requirements,fact.sections[2].text)
  assert.equal(fact.nativeEmployerBrand,'AI21 Labs')
  assert.equal(fact.applicationVisited,false)
 }
 assert.equal(audit.nativeObservations[1].sections[1].text,'','the publisher genuinely supplies an empty TPM responsibilities section')
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 for(const key of ['sourceScopeComplete','sourceCompanyWideScopeComplete','indiaScopeComplete','lifecycleCleanupAllowed'])assert.equal(audit[key],false)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'discovery-only');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(fixture.calls,[ROOT,...roles.map(r=>r.url)])
 for(const receipt of audit.responses){const p=packets.get(receipt.requestedURL);assert.equal(receipt.status,p.record.status);assert.equal(receipt.bodySHA256,p.record.sha256);assert.equal(receipt.sourceRequestedAt,p.record.sourceRequestedAt);assert.equal(receipt.sourceCompletedAt,p.record.sourceCompletedAt)}
 assert.deepEqual(fixture.network,[])
})
test('AI21 missing native requirements stays incomplete while positive card observations survive',async t=>{
 const fixture=offline(t,p=>{if(p.url===roles[0].url)p.body=p.body.replace(/<div class="career__details-item">\s*<h2 class="details__item-title">\s*Requirements\s*<\/h2>[\s\S]*?(?=<div class="career__details-item">)/,'')})
 const jobs=await run(fixture.options),fact=jobs.sourceAudit.nativeObservations[0]
 assert.equal(fact.sourceDetailComplete,false);assert.equal(readSourceObservationEvidence(jobs,'ai21labs').observedVacancyCount,3)
 assert.equal(jobs.length,0);assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,false)
})
test('AI21 changed detail identity cannot replace the current native card',async t=>{
 const fixture=offline(t,p=>{if(p.url===roles[0].url)p.body=p.body.replace(/(<h1 class="career__title">)\s*Deep Learning Engineer\s*(<\/h1>)/,'$1Different Role$2')})
 const jobs=await run(fixture.options),fact=jobs.sourceAudit.nativeObservations[0]
 assert.equal(fact.title,'Deep Learning Engineer');assert.equal(fact.sourceDetailComplete,false);assert.match(fact.detailError.message,/title/i)
})
test('AI21 denied native detail retains its actual HTTP status without declaring empty India inventory',async t=>{
 const fixture=offline(t,p=>{if(p.url===roles[0].url){p.status=403;p.body='Forbidden'}})
 const jobs=await run(fixture.options),fact=jobs.sourceAudit.nativeObservations[0]
 assert.equal(fact.sourceDetailComplete,false);assert.equal(fact.detailError.status,403);assert.equal(fact.detailError.failureKind,'blocked_or_access_denied')
 assert.equal(jobs.sourceAudit.responses[1].status,403);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
test('AI21 denied root fails with original status and no secondary requests',async t=>{
 const fixture=offline(t,p=>{if(p.url===ROOT){p.status=403;p.body='Forbidden'}})
 await assert.rejects(run(fixture.options),e=>e.status===403&&e.failureKind==='blocked_or_access_denied'&&e.lifecycleCleanupAllowed===false)
 assert.deepEqual(fixture.calls,[ROOT])
})
test('AI21 cancellation interrupts an injected reader that ignores its signal',async t=>{
 const fixture=offline(t),controller=new AbortController(),reason=Error('Caller cancelled AI21')
 const promise=run({...fixture.options,signal:controller.signal,fetchImpl:()=>new Promise(()=>{})})
 setTimeout(()=>controller.abort(reason),15)
 await assert.rejects(promise,e=>e===reason)
})
test('AI21 source deadline bounds an injected reader that never resolves',async t=>{
 const fixture=offline(t)
 await assert.rejects(run({...fixture.options,sourceTimeoutMs:30,requestTimeoutMs:200,fetchImpl:()=>new Promise(()=>{})}),e=>e.failureKind==='coverage_gap'&&/deadline/i.test(e.message)&&e.lifecycleCleanupAllowed===false)
})




test('AI21 raw fetchImpl takes precedence over unqualified alternative text/page transports',async t=>{
 const fixture=offline(t)
 const jobs=await run({...fixture.options,fetchPage:()=>{throw Error('Alternative transport must not replace the raw entity')}})
 assert.equal(jobs.sourceAudit.nativeObservations.filter(r=>r.sourceDetailComplete).length,3)
})

test('AI21 body-unavailable original200 stays unavailable with its acquisition clocks',async t=>{
 const fixture=offline(t),record=packets.get(ROOT).record
 await assert.rejects(run({...fixture.options,fetchImpl:async()=>{
  const response=new Response(null,{status:200,headers:{'content-type':record.contentType}})
  Object.defineProperty(response,'url',{value:ROOT});Object.defineProperty(response,'sourceCapture',{value:{bodyUnavailable:true,sourceRequestedAt:record.sourceRequestedAt,sourceCompletedAt:record.sourceCompletedAt}})
  return response
 }}),error=>{
  assert.equal(error.failureKind,'coverage_gap');const receipt=error.nativeEvidence.responses[0]
  assert.equal(receipt.status,200);assert.equal(receipt.bodyUnavailable,true);assert.equal(receipt.bodySHA256,undefined)
  assert.equal(receipt.sourceRequestedAt,record.sourceRequestedAt);assert.equal(receipt.sourceCompletedAt,record.sourceCompletedAt)
  return true
 })
})

test('AI21 exact stream hash and byte count preserve a UTF8 BOM and non-ASCII text',async t=>{
 const fixture=offline(t,p=>{if(p.url===ROOT)p.body='\uFEFF'+p.body}),jobs=await run({...fixture.options,maxRequests:1})
 const bytes=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),packets.get(ROOT).bytes]),receipt=jobs.sourceAudit.responses[0]
 assert.equal(receipt.bodySHA256,hash(bytes));assert.equal(receipt.bodyBytes,bytes.length)
 assert.notEqual(receipt.bodySHA256,receipt.decodedBodySHA256)
})

test('AI21 source-local metadata exposes unknown totals and no stale verified-empty claim',async()=>{
 const {default:metadata}=await import('../../scraper/ai21labs/catalog.js')
 assert.equal(metadata.verifiedPublicJobCount,null);assert.equal(metadata.verifiedIndiaJobCount,null);assert.equal(metadata.verifiedOn,null)
 assert.equal(metadata.sourceScopeComplete,false);assert.equal(metadata.lifecycleCleanupAllowed,false)
 assert.equal(metadata.companyGlobalTotal,null);assert.equal(metadata.companyIndiaTotal,null)
 assert.equal(metadata.inventoryEvidenceStatus,'discovery-only')
})


test('AI21 fetchPage-only adapter preserves exact provided bytes and original capture clocks',async t=>{
 const fixture=offline(t)
 const jobs=await run({...fixture.options,fetchImpl:undefined,fetchPage:async url=>{
  const {record,bytes}=packets.get(url)
  return{status:record.status,url:record.finalUrl,contentType:record.contentType,body:bytes.toString('utf8'),bodyBase64:bytes.toString('base64'),sourceCapture:{sourceRequestedAt:record.sourceRequestedAt,sourceCompletedAt:record.sourceCompletedAt,bodySHA256:record.sha256}}
 }})
 assert.equal(jobs.sourceAudit.nativeObservations.filter(r=>r.sourceDetailComplete).length,3)
 for(const receipt of jobs.sourceAudit.responses){assert.equal(receipt.bodySHA256,packets.get(receipt.requestedURL).record.sha256);assert.equal(receipt.byteProvenance,'provided-original-bodyBase64')}
})

test('AI21 unavailable fetchPage403 preserves denial status before the missing-body condition',async t=>{
 const fixture=offline(t)
 await assert.rejects(run({...fixture.options,fetchImpl:undefined,fetchPage:async()=>({status:403,url:ROOT,contentType:'text/html',sourceCapture:{bodyUnavailable:true}})}),e=>e.status===403&&e.failureKind==='blocked_or_access_denied'&&e.nativeEvidence.responses[0].status===403)
})
