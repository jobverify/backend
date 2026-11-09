import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run} from './script.js'

const packet=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/2026-10-31-official-current.json.gz',import.meta.url)))).packet
const response=(body=packet.body,{status=200,url=packet.url,headers={}}={})=>{
 const result=new Response(body,{status,headers:{'content-type':'text/html',...headers}})
 Object.defineProperty(result,'url',{value:url})
 return result
}

test('registered default HTTP boundary reads only the official opening and independent closing page',async t=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return response()})
 const jobs=await run()
 assert.equal(calls.length,2)
 assert.equal(jobs.length,0)
 assert.ok(calls.every(c=>c.url===packet.url&&c.options.method==='GET'&&c.options.redirect==='manual'&&c.options.signal instanceof AbortSignal))
})

test('HTTP denial, throttling and errors stop after one request with unknown inventory',async t=>{
 for(const status of [401,403,429,500]){
  let calls=0
  const mock=t.mock.method(globalThis,'fetch',async()=>{calls++;return response('upstream unavailable',{status})})
  await assert.rejects(run(),error=>error.status===status&&error.abortRetries===true&&error.inventoryEvidence.reportedTotal===null&&error.inventoryEvidence.indiaFacetCount===null)
  assert.equal(calls,1)
  mock.mock.restore()
 }
})

test('redirects, unexpected final identity and an HTTP200 challenge cannot become empty inventory',async t=>{
 for(const make of [()=>response('',{status:302,headers:{location:'https://example.org/'}}),()=>response(packet.body,{url:'https://example.org/journey'}),()=>response('<title>Access Denied</title>')]){
  let calls=0
  const mock=t.mock.method(globalThis,'fetch',async()=>{calls++;return make()})
  await assert.rejects(run(),error=>error.abortRetries===true&&error.inventoryEvidence.reportedTotal===null)
  assert.equal(calls,1)
  mock.mock.restore()
 }
})

test('an oversized streamed native body is bounded and cancelled before any closing read',async t=>{
 let cancelled=0,calls=0
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1_000_001))},cancel(){cancelled++}})
 t.mock.method(globalThis,'fetch',async()=>{calls++;return response(stream)})
 await assert.rejects(run(),/oversized|body.*limit/i)
 assert.equal(calls,1)
 assert.equal(cancelled,1)
})

test('a caller already aborted prevents native requests and retains its exact reason',async t=>{
 const controller=new AbortController(),reason=Error('controlled caller stop')
 controller.abort(reason)
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;return response()})
 await assert.rejects(run({signal:controller.signal}),error=>error===reason)
 assert.equal(calls,0)
})

test('caller cancellation while awaiting native headers rejects promptly without retries or fallback',async t=>{
 const controller=new AbortController(),reason=Error('controlled waiting-header caller stop')
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})})
 await assert.rejects(run({signal:controller.signal}),error=>error===reason)
 assert.equal(calls,1)
})

test('caller cancellation after native headers cancels the pending body and preserves its reason',async t=>{
 const controller=new AbortController(),reason=Error('controlled body caller stop')
 let calls=0,cancelled=0
 const stream=new ReadableStream({pull(){queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})},cancel(){cancelled++}})
 t.mock.method(globalThis,'fetch',async()=>{calls++;return response(stream)})
 await assert.rejects(run({signal:controller.signal}),error=>error===reason)
 assert.equal(calls,1)
 assert.equal(cancelled,1)
})

test('the native request deadline bounds an uncooperative header transport without retries',async t=>{
 let calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Promise(()=>{})})
 await assert.rejects(run({requestTimeoutMs:10}),error=>error.name==='TimeoutError'&&error.abortRetries===true)
 assert.equal(calls,1)
})
