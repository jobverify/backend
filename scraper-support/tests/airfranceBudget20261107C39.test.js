import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import test from 'node:test'
import {run} from '../../scraper/airfranceklm.workday/script.js'

// These are the existing self-contained sanitized native fixtures. They retain
// complete native criteria but are not original HTTP entities or fresh captures.
const root=new URL('../../scraper/airfranceklm.workday/test-data/',import.meta.url)
const provenance=JSON.parse(readFileSync(new URL('provenance.json',root)))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const fixtures=new Map(provenance.receipts.map(row=>{const bytes=readFileSync(new URL(row.file,root));assert.equal(sha(bytes),row.fixtureSHA256);return [row.derivedFrom.url,bytes]}))
const HOME='https://recrutement.airfrance.com/accueil.aspx?lcid=2057'
const page=url=>{const bytes=fixtures.get(url);if(!bytes)throw Object.assign(Error('Sanitized offline input not provided'),{code:'OFFLINE_INPUT_NOT_PROVIDED'});return {url,requestedUrl:url,status:200,headers:{'content-type':'text/html; charset=utf-8'},bodyBase64:bytes.toString('base64'),sourceRequestedAt:'2026-10-01T00:00:00.000Z',sourceCompletedAt:'2026-10-01T00:00:00.001Z',sanitizedDerivedFixture:true}}
const guard=t=>{let requests=0;t.mock.method(globalThis,'fetch',()=>{requests++;throw Error('External network forbidden')});t.after(()=>assert.equal(requests,0))}

test('C39 default accepts a valid9s response before the injected15s physical acquisition cap',async t=>{
 guard(t)
 const physical=new AbortController(),physicalTimer=setTimeout(()=>physical.abort(Error('Synthetic15s physical cap')),15000)
 let calls=0,delivered=false
 try{
  const jobs=await run({maxRequests:1,maxPages:1,fetchPage:async(url,init)=>{
   calls++;assert.equal(url,HOME);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
   await delay(9000,undefined,{signal:AbortSignal.any([physical.signal,init.signal])})
   delivered=true;return page(url)
  }})
  assert.equal(delivered,true);assert.equal(calls,1);assert.equal(physical.signal.aborted,false)
  assert.equal(jobs.nativeCollectionEvidence.responses[0].sha256,sha(fixtures.get(HOME)))
  assert.equal(jobs.nativeCollectionEvidence.records.length,50)
  assert.equal(jobs.nativeCollectionEvidence.bounds.requestTimeoutMs,20000)
 }finally{clearTimeout(physicalTimer)}
})

test('C39 five-GET default budget allows75s physical acquisition plus15s callbacks and10s slack',async t=>{
 guard(t);const requests=[]
 const jobs=await run({fetchPage:async(url,init)=>{requests.push(url);init.throwIfAborted();return page(url)}})
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.bounds.requestTimeoutMs,20000);assert.equal(audit.bounds.sourceTimeoutMs,100000)
 assert.equal(audit.bounds.callbackTimeoutMs,5000)
 assert.equal(audit.bounds.sourceTimeoutMs,5*15000+3*audit.bounds.callbackTimeoutMs+10000)
 assert.equal(audit.bounds.maxRequests,5);assert.equal(audit.bounds.maxPages,2);assert.equal(audit.bounds.maxDetails,3)
 assert.equal(requests.length,5);assert.equal(audit.records.length,50);assert.equal(audit.detailRecords.length,2)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
})

for(const kind of ['request','source'])test('C39 explicit short '+kind+' budget preserves its exact original deadline reason',async t=>{
 guard(t);let signalled
 await assert.rejects(run({requestTimeoutMs:kind==='request'?5:1000,sourceTimeoutMs:kind==='source'?5:1000,fetchPage:async(url,init)=>{
  init.signal.addEventListener('abort',()=>{signalled=init.signal.reason},{once:true})
  return new Promise(()=>{})
 }}),error=>{assert.strictEqual(error,signalled);assert.equal(error.message,'Air France native reader: '+kind+' deadline exceeded');assert.equal(error.failureKind,'network_or_timeout');return true})
})

test('C39 injected physical failure retains identity before a longer native caller budget',async t=>{
 guard(t);const physical=new AbortController(),reason=Object.freeze(Error('Synthetic physical acquisition deadline')),timer=setTimeout(()=>physical.abort(reason),5)
 try{await assert.rejects(run({requestTimeoutMs:1000,sourceTimeoutMs:2000,fetchPage:async()=>{
  await new Promise((resolve,reject)=>{const abort=()=>reject(physical.signal.reason);if(physical.signal.aborted)abort();else physical.signal.addEventListener('abort',abort,{once:true})})
 }}),error=>error===reason)}finally{clearTimeout(timer)}
})

test('C39 caller cancellation retains an opaque original reason with no timer wait',async t=>{
 guard(t);const controller=new AbortController(),reason=Object.freeze({cancel:'C39 original caller reason'})
 const pending=run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})});controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
 let calls=0;await assert.rejects(run({signal:controller.signal,fetchPage:()=>{calls++}}),error=>error===reason);assert.equal(calls,0)
})

test('C39 generic detail overrides retain the five-detail hard ceiling and seven total document attempts',async t=>{
 guard(t);let calls=0;const jobs=await run({maxRequests:128,maxDetails:80,fetchPage:async url=>{calls++;return page(url)}})
 assert.equal(jobs.nativeCollectionEvidence.bounds.maxDetails,5);assert.equal(calls,7)
 assert.equal(jobs.nativeCollectionEvidence.records.length,50);assert.equal(jobs.nativeCollectionEvidence.detailRecords.length,3)
 assert.ok(jobs.nativeCollectionEvidence.detailRecords.every(row=>row.country==='France'&&row.legalEmployer===null))
 assert.equal(jobs.length,0)
})
