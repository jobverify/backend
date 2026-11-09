import assert from 'node:assert/strict'
import test from 'node:test'
import {readNativePublicDocument} from './nativeTransport.js'
import {createLangchainNativeScraper} from './nativeInventory.js'
const URL='https://www.langchain.com/careers'
const failure=()=>Error('Original response stream failed')
for(const status of [200,403]) test('original HTTP '+status+' body failure keeps primary transport provenance',async t=>{
 const original=failure(),controller=new AbortController();let cancels=0,releases=0
 t.mock.method(globalThis,'fetch',async url=>({status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read:async()=>{throw original},cancel:async()=>{cancels++},releaseLock(){releases++}}}}}))
 await assert.rejects(readNativePublicDocument(URL,{signal:controller.signal,check:()=>controller.signal.throwIfAborted(),byteLimit:8000000}),error=>{
  if(status===200)return error===original
  assert.equal(error.status,403);assert.equal(error.upstreamOutage,true);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.cause,original)
  assert.equal(error.nativeHttpReceipt.status,403);assert.equal(error.nativeHttpReceipt.bodyUnavailable,true);assert.equal(error.nativeHttpReceipt.bodySHA256,null);return true
 })
 assert.equal(cancels,1);assert.equal(releases,1)
})
test('registered original403 body failure stays denied with original cause and raw-body-unavailable receipt',async t=>{
 const original=failure()
 t.mock.method(globalThis,'fetch',async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read:async()=>{throw original},cancel:async()=>{},releaseLock(){}}}}}))
 await assert.rejects(createLangchainNativeScraper().run(),error=>{assert.equal(error.status,403);assert.equal(error.cause,original);assert.equal(error.upstreamOutage,true);assert.equal(error.nativeCollectionEvidence.retainedResponses.length,1);assert.equal(error.nativeCollectionEvidence.retainedResponses[0].bodyUnavailable,true);return true})
})
test('observed403 body deadline preserves denial while actual200 deadline remains exact',async t=>{
 for(const status of [403,200]){
  const controller=new AbortController(),reason=Error('Synthetic request deadline exceeded');let began
  const reading=new Promise(resolve=>{began=resolve})
  t.mock.method(globalThis,'fetch',async url=>({status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read:()=>{began();return new Promise(()=>{})},cancel:async()=>{},releaseLock(){}}}}}))
  const pending=readNativePublicDocument(URL,{signal:controller.signal,callerSignal:null,check:()=>controller.signal.throwIfAborted(),byteLimit:8000000})
  await reading;controller.abort(reason)
  await assert.rejects(pending,error=>status===200?error===reason:error.status===403&&error.cause===reason&&error.upstreamOutage===true)
 }
})
for(const reason of [Object.freeze({abort:'caller'}),Symbol('opaque caller'),null])test('caller abort after403 wins exactly over known denial: '+String(reason),async t=>{
 const caller=new AbortController();let began
 const reading=new Promise(resolve=>{began=resolve})
 t.mock.method(globalThis,'fetch',async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read:()=>{began();return new Promise(()=>{})},cancel:async()=>{},releaseLock(){}}}}}))
 const pending=createLangchainNativeScraper().run({signal:caller.signal});await reading;caller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
})
test('registered aggregate expiry after403 retains original403 with deadline cause and bounded read',async t=>{
 t.mock.method(globalThis,'fetch',async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read:()=>new Promise(()=>{}),cancel:async()=>{},releaseLock(){}}}}}))
 await assert.rejects(createLangchainNativeScraper().run({sourceTimeoutMs:25}),error=>error.status===403&&error.upstreamOutage===true&&/deadline/.test(error.cause.message))
})

test('registered completed403 keeps original body and numeric denial attribution',async t=>{
 const body='Synthetic original access denial body'
 t.mock.method(globalThis,'fetch',async url=>{const response=new Response(body,{status:403,headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:url});return response})
 await assert.rejects(createLangchainNativeScraper().run(),error=>{assert.equal(error.status,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.upstreamOutage,true);assert.equal(error.nativeCollectionEvidence.retainedResponses[0].body,body);return true})
})
