import assert from 'node:assert/strict'
import fs from 'node:fs'
import {syncBuiltinESMExports} from 'node:module'
import nodeTest from 'node:test'
import {createCatalogScraper} from '../providers/index.js'
import {runScraperWithTimeout} from '../runner.js'
import {acquireWorkdaySourceAdmission} from '../shared/workdaySourceAdmission.js'
import {source,PROFILE,URLS,configPath,packet,provider,responseFor,exercise,assertPrefixUnavailable,deferred,flush} from './cocaColaWorkday20261102.helpers.mjs'
const test=(name,operation)=>nodeTest(name,{concurrency:false,timeout:5000},operation)

test('Coca-Cola originalAugust1 verification declaration remains historical',()=>{
 assert.equal(source.SOURCE,'cocacola');assert.equal(source.COMPANY,'Coca-Cola');assert.equal(source.VERIFIED_ON,'2026-08-01')
})

for(const entry of ['source','registered'])test('Coca-Cola '+entry+' uses the actual3-hop native chain and preserves unobserved190-role scope',async t=>{
 const result=await exercise(t,{entry})
 assertPrefixUnavailable(result)
 assert.equal(provider().verifiedPublicJobCount,null)
 assert.equal(provider().verifiedIndiaJobCount,null)
})

test('Coca-Cola caller fields cannot replace source,company,URLs,profile or explicit redirect contract',async t=>{
 const result=await exercise(t,{entry:'source',options:{source:'foreign',company:'Other Employer',baseUrl:'https://other.wd1.myworkdayjobs.com/Other',scraperDir:'C:/controlled-nonexistent-profile',officialVanityRedirectStatus:302,locationCountry:'c4f78be1a8f14da0ab49ce1162348a5e',boardIdentityVerified:true}})
 assertPrefixUnavailable(result)
})

for(const [label,value]of [['missing',null],['malformed','{'],['wrong301',JSON.stringify({...PROFILE,officialVanityRedirectStatus:302})],['extraKey',JSON.stringify({...PROFILE,boardIdentityVerified:true})],['wrongBoard',JSON.stringify({...PROFILE,detailUrlBase:'https://other.wd1.myworkdayjobs.com/Other'})]])test('Coca-Cola '+label+' mandatory sealed profile fails before transport',async t=>{
 const original=fs.readFileSync
 const mock=t.mock.method(fs,'readFileSync',(file,...args)=>{if(String(file)===configPath){if(value===null)throw Object.assign(new Error('CONTROLLED missing profile'),{code:'ENOENT'});return value}return original(file,...args)})
 syncBuiltinESMExports()
 let result
 try{result=await exercise(t,{entry:'source'})}finally{mock.mock.restore();syncBuiltinESMExports()}
 assert.equal(result.rejected,true);assert.equal(result.jobs,undefined)
 assert.equal(result.error.code,'WORKDAY_SOURCE_CONFIG_INVALID')
 assert.equal(result.calls.length,0)
})

test('Coca-Cola caller pre-abort returns opaque Error,object,string,null and zero without reading the profile or fetching',async t=>{
 const opaque=Object.freeze(Object.defineProperty({},'message',{get(){assert.fail('Caller reason must remain opaque')}}))
 for(const reason of [Object.freeze(new Error('controlled caller')),opaque,'caller',null,0]){
  const controller=new AbortController();controller.abort(reason)
  const result=await exercise(t,{entry:'source',options:{signal:controller.signal}})
  assert.equal(result.rejected,true);assert.equal(result.error,reason);assert.equal(result.calls.length,0)
 }
})

test('Coca-Cola replay clock getters remain unread and cannot create a qualified handoff timestamp',async t=>{
 let reads=0
 const result=await exercise(t,{entry:'source',onResponse(response,kind){
  if(kind!=='primary')return
  delete response.capturedAt
  Object.defineProperty(response,'capturedAt',{get(){reads++;return packet('primary').packet.completedAt},configurable:true})
 }})
 assertPrefixUnavailable(result)
 assert.equal(reads,0)
})

const ownedHop=async(t,kind)=>{
 const caller=new AbortController(),reason=Object.freeze(new Error('CONTROLLED owned '+kind+' caller abort'))
 const started=deferred(),cancelStarted=deferred(),cancelGate=deferred(),sourceDone=deferred(),calls=[],slots=new Set()
 let cancelCalls=0,sourceSettled=false,releases=0,timeoutId,nextLease,queueResult,operation
 const stream=new ReadableStream({pull(){started.resolve();return new Promise(()=>{})},cancel(){cancelCalls++;cancelStarted.resolve();return cancelGate.promise}},{highWaterMark:0})
 const mock=t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const url=String(input),current=url===URLS.primary?'primary':url===URLS.vanity?'redirect':url===URLS.board?'bootstrap':null
  calls.push({url,signal:init.signal})
  assert.ok(current,'No CXS or alternative URL may start after a held proof hop')
  return responseFor(current,current===kind?{body:stream}:{})
 })
 const registered=createCatalogScraper(provider())
 const monitored={...registered,run:options=>registered.run({...options,requestTimeoutMs:1000,retryBaseDelayMs:0,requestScheduler:{acquire:async()=>{const slot=Symbol('owned-hop');slots.add(slot);return ()=>{slots.delete(slot);releases++}},recordRateLimit(){}}}).finally(()=>{sourceSettled=true;sourceDone.resolve()})}
 operation=runScraperWithTimeout(monitored,1000,{signal:caller.signal,abortGraceMs:10,nativeDetailRecovery:false,admissionTimeoutMs:1000}).then(value=>({rejected:false,value}),error=>({rejected:true,error}))
 try{
  await Promise.race([started.promise,operation.then(()=>assert.fail('Controlled '+kind+' body read must start'))])
  caller.abort(reason)
  await Promise.race([cancelStarted.promise,operation.then(()=>assert.fail('First reader.cancel must be observed'))])
  const outcome=await Promise.race([operation,new Promise((resolve,reject)=>{timeoutId=setTimeout(()=>reject(new Error('Bounded runner did not return')),500)})])
  clearTimeout(timeoutId)
  assert.equal(outcome.rejected,true);assert.equal(outcome.error,reason)
  assert.equal(sourceSettled,false,'Underlying source must keep the FIRSTreader.cancel promise owned')
  assert.equal(cancelCalls,1);assert.equal(slots.size,1)
  queueResult=await acquireWorkdaySourceAdmission(registered,{admissionTimeoutMs:40}).then(lease=>{lease.release();return {admitted:true}},error=>({admitted:false,error}))
  assert.equal(queueResult.admitted,false)
  assert.equal(queueResult.error.code,'WORKDAY_SOURCE_ADMISSION_TIMEOUT')
  assert.equal(queueResult.error.phase,'queue')
  assert.equal(sourceSettled,false)
  cancelGate.resolve();await sourceDone.promise
  nextLease=await acquireWorkdaySourceAdmission(registered,{admissionTimeoutMs:1000})
  assert.equal(slots.size,0);assert.equal(releases,calls.length)
  assert.equal(cancelCalls,1)
  assert.deepEqual(calls.map(c=>c.url),[URLS.primary,...(kind==='redirect'||kind==='bootstrap'?[URLS.vanity]:[]),...(kind==='bootstrap'?[URLS.board]:[])])
 }finally{
  clearTimeout(timeoutId);caller.abort(reason);cancelGate.resolve();await operation
  if(cancelCalls)await sourceDone.promise
  nextLease?.release();nextLease?.release();mock.mock.restore()
 }
}
for(const kind of ['primary','redirect','bootstrap'])test('Coca-Cola new301mode '+kind+' first-reader cancellation owns the scheduler and admitted shard until disposal settles',async t=>ownedHop(t,kind))

test('Coca-Cola own native deadline remains exact after deferred first-reader cancellation without a prompt source race',async t=>{
 const started=deferred(),cancelStarted=deferred(),cancelGate=deferred()
 let signal,cancelCalls=0,settled=false,result
 const stream=new ReadableStream({pull(){started.resolve();return new Promise(()=>{})},cancel(){cancelCalls++;cancelStarted.resolve();return cancelGate.promise}},{highWaterMark:0})
 const pending=exercise(t,{entry:'source',options:{requestTimeoutMs:15},customFetch:async(url,init)=>{
  assert.equal(url,URLS.primary);signal=init.signal;return responseFor('primary',{body:stream})
 }}).then(value=>{settled=true;return value})
 try{
  await Promise.race([started.promise,pending.then(()=>assert.fail('Primary read must start'))])
  await cancelStarted.promise;await flush()
  assert.equal(settled,false)
  assert.equal(signal.aborted,true)
  assert.equal(signal.reason.name,'WorkdayRequestTimeoutError')
  cancelGate.resolve();result=await pending
  assert.equal(result.rejected,true);assert.equal(result.error,signal.reason);assert.equal(result.calls.length,1)
  assert.equal(cancelCalls,1);assert.equal(result.slots.size,0)
 }finally{cancelGate.resolve();await pending}
})
