import assert from 'node:assert/strict'
import test from 'node:test'
import {run as aarogyaai} from '../../scraper/aarogyaai/script.js'

// Scripted transport controls only. No original body is mutated and no public
// request occurs. Signal-ignoring late fetch is explicitly an injected model.
const URL='https://aarogyaai.com/'
const html='<title>AarogyaAI</title><p>Synthetic corporate diagnostic only</p>'
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const block=ms=>{const start=performance.now();while(performance.now()-start<ms){}}
const response=reader=>({status:200,url:URL,headers:new Headers({'content-type':'text/html; charset=utf-8'}),body:{getReader:()=>reader}})
const finiteReader=(firstValue,beforeRead=()=>{})=>{let first=true;return{read(){if(first){first=false;beforeRead();return Promise.resolve({done:false,value:firstValue})}return Promise.resolve({done:true})},cancel(){return Promise.resolve()},releaseLock(){}}}
const deadlineError=error=>{assert.equal(error.failureKind,'network_or_timeout');assert.match(error.message,/deadline|timeout/i);assert.equal(error.inventoryEvidence.listingComplete,false);return true}

test('review: intrinsic Uint8Array size is enforced before copying a spoofed oversized chunk',async()=>{
 const chunk=new Uint8Array(2*1024*1024+1)
 Object.defineProperty(chunk,'byteLength',{value:0})
 const original=Buffer.from;let copied=0
 Buffer.from=function(value,...args){if(value===chunk)copied+=chunk.length;return original.call(this,value,...args)}
 try{
  await assert.rejects(aarogyaai({fetchImpl:async()=>response(finiteReader(chunk)),requestTimeoutMs:100}),error=>{assert.match(error.message,/byte|size|limit/i);return true})
  assert.equal(copied,0,'Overflowing genuine typed bytes must be refused before Buffer.from')
 }finally{Buffer.from=original}
})
test('review: request deadline includes synchronous work before response headers are delivered',async()=>{
 await assert.rejects(aarogyaai({requestTimeoutMs:1,collectionTimeoutMs:200,fetchImpl:()=>{block(35);return response(finiteReader(new TextEncoder().encode(html)))}}),deadlineError)
})
test('review: request body deadline includes a synchronous blocking read before final delivery',async()=>{
 await assert.rejects(aarogyaai({requestTimeoutMs:1,collectionTimeoutMs:200,fetchImpl:async()=>response(finiteReader(new TextEncoder().encode(html),()=>block(35)))}),deadlineError)
})
test('review: source deadline includes synchronous injected operation work',async()=>{
 await assert.rejects(aarogyaai({requestTimeoutMs:200,collectionTimeoutMs:1,probeUrl:()=>{block(35);return{status:200,url:URL,finalUrl:URL,html}}}),deadlineError)
})
test('review: a signal-ignoring injected late fetch response is cancelled without acquiring its reader',async()=>{
 const late=deferred();let cancelled=0,acquired=0,requestSignal
 const run=aarogyaai({requestTimeoutMs:5,collectionTimeoutMs:200,fetchImpl:(_url,init)=>{requestSignal=init.signal;return late.promise}})
 await assert.rejects(run,deadlineError)
 assert.equal(requestSignal.aborted,true)
 late.resolve({status:200,url:URL,headers:new Headers({'content-type':'text/html'}),body:{cancel(){cancelled++;return Promise.resolve()},getReader(){acquired++;throw Error('Late reader must not be acquired')}}})
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))
 assert.equal(acquired,0)
 assert.equal(cancelled,1,'Transport must own and cancel a response arriving after its aborted race')
})
test('review: pending-body cancellation preserves the exact opaque falsy caller reason',async()=>{
 const entered=deferred(),controller=new AbortController();let cancelled=0
 const reader={read(){entered.resolve();return new Promise(()=>{})},cancel(){cancelled++;return Promise.resolve()},releaseLock(){}}
 const run=aarogyaai({signal:controller.signal,requestTimeoutMs:100,fetchImpl:async()=>response(reader)})
 await entered.promise;controller.abort(0)
 let rejected=false
 try{await run}catch(error){rejected=true;assert.strictEqual(error,0)}
 assert.equal(rejected,true);assert.equal(cancelled,1)
})
test('review: a redirect preserves its original HTTP status and is cancelled before body or follow-up reads',async()=>{
 let calls=0,cancelled=0,readerAcquisitions=0
 await assert.rejects(aarogyaai({fetchImpl:async(url,init)=>{
  calls++;assert.equal(url,URL);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  return{status:302,url:URL,headers:new Headers({'location':'https://unrelated.invalid/'}),body:{cancel(){cancelled++;return Promise.resolve()},getReader(){readerAcquisitions++;throw Error('No redirect body read')}}}
 }}),error=>{assert.equal(error.status,302);assert.equal(error.requestUrl,URL);assert.equal(error.failureKind,'surface_drift_or_fail_closed');assert.equal(error.inventoryEvidence.listingComplete,false);assert.equal(error.inventoryEvidence.reportedTotal,null);return true})
 assert.equal(calls,1);assert.equal(cancelled,1);assert.equal(readerAcquisitions,0)
})
