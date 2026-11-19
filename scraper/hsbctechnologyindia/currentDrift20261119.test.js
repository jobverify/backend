import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-drift-20261119.json.gz',import.meta.url))))
const within=(promise,milliseconds=120)=>Promise.race([promise,new Promise((_,reject)=>{
 const timer=setTimeout(()=>reject(new Error('HSBC acquisition did not settle within its configured deadline')),milliseconds)
 promise.finally(()=>clearTimeout(timer)).catch(()=>{})
})])
test('HSBC current changed whole classic client remains unqualified instead of yielding a false empty inventory',async()=>{
 let reads=0
 await assert.rejects(run({now:fixture.startedAt,fetchImpl:async(url,init)=>{
  const packet=fixture.packets[reads++];assert.ok(packet,'Only original public responses')
  assert.equal(String(url),packet.url);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const raw=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(raw).digest('hex'),packet.bodySHA256)
  const response=new Response(raw,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }}),error=>error.softFailure===true&&error.failureKind==='surface_drift_or_fail_closed'
  &&/native renderer criteria contract changed/.test(error.message)
  &&error.nativeCollectionEvidence.receipts.length===3
  &&error.nativeCollectionEvidence.receipts.every((receipt,index)=>receipt.sha256===fixture.packets[index].bodySHA256)
  &&error.nativeCollectionEvidence.sourceScopeComplete===false)
 assert.equal(reads,3)
})

test('HSBC pre-aborted caller starts zero public reads and retains its exact opaque reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({hsbc:'already stopped'})
 controller.abort(reason);let reads=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:()=>{reads++;throw Error('not reached')}}),error=>error===reason)
 assert.equal(reads,0)
})

test('HSBC caller cancellation preserves its exact reason when a public acquisition ignores the signal',async()=>{
 const controller=new AbortController(),reason=Symbol('HSBC caller stop')
 let reads=0
 const pending=run({signal:controller.signal,fetchImpl:()=>{reads++;return new Promise(()=>{})}})
 setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(within(pending),error=>error===reason)
 assert.equal(reads,1)
})

test('HSBC per-request deadline includes an uncooperative public callback',async()=>{
 let reads=0
 await assert.rejects(within(run({requestTimeoutMs:15,fetchImpl:()=>{reads++;return new Promise(()=>{})}})),{name:'TimeoutError'})
 assert.equal(reads,1)
})

test('HSBC total deadline includes a stalled native response body',async()=>{
 let reads=0,cancels=0
 await assert.rejects(within(run({sourceTimeoutMs:15,fetchImpl:async url=>{
  reads++
  const response=new Response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel(){cancels++}}),{headers:{'content-type':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 }})),{name:'TimeoutError'})
 assert.equal(reads,1);assert.equal(cancels,1)
})

test('HSBC preserves a denied original response and holds source completeness',async()=>{
 const body='Current native public access denied'
 await assert.rejects(run({fetchImpl:async url=>{
  const response=new Response(body,{status:403,headers:{'content-type':'text/plain'}})
  Object.defineProperty(response,'url',{value:url});return response
 }}),error=>{
  const receipt=error.nativeCollectionEvidence.receipts[0]
  return/current native GET identity\/status changed/.test(error.message)&&receipt.status===403&&receipt.html===body
   &&error.nativeCollectionEvidence.lifecycleCleanupAllowed===false
 })
})
