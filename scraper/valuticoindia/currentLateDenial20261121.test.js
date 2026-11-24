import test from 'node:test'
import assert from 'node:assert/strict'
import {runCurrentValutico} from './currentNative20261121.js'
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function lateDenied(status,onCancel=()=>{}){
 const state={calls:0,readers:0,cancels:0,settled:false,metadataObserved:false}
 return{state,fetchImpl:async url=>{
  state.calls++;await sleep(1100);state.metadataObserved=true
  return{status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){state.readers++;throw Error('Denied entity must remain unread')},async cancel(){state.cancels++;onCancel();await sleep(20);state.settled=true}}}
 }}
}
for(const status of [403,429])test('known '+status+' arriving during final close preserves primary HTTP and refreshed audit',async()=>{
 const {state,fetchImpl}=lateDenied(status)
 let error;try{await runCurrentValutico({fetchImpl,sourceTimeoutMs:5000,requestTimeoutMs:5,requestIntervalMs:0})}catch(caught){error=caught}
 assert.equal(state.calls,1);assert.equal(state.readers,0);assert.equal(state.cancels,1);assert.equal(state.metadataObserved,true);assert.equal(state.settled,true)
 assert.equal(error?.httpStatus,status)
 const evidence=error.nativeCollectionEvidence
 assert.equal(evidence.transport.receipts[0].status,status);assert.equal(evidence.transport.receipts[0].bodyComplete,false)
 assert.equal(evidence.failure.httpStatus,status);assert.equal(evidence.lifecycleCleanupAllowed,false)
})
for(const status of [403,429])for(const kind of ['frozen','null'])test('caller '+kind+' reason during late '+status+' disposal owns final return after settled cleanup',async()=>{
 const caller=new AbortController,reason=kind==='null'?null:Object.freeze({opaque:'caller-owned'})
 const {state,fetchImpl}=lateDenied(status,()=>caller.abort(reason))
 let caught=Symbol('no-error');try{await runCurrentValutico({fetchImpl,signal:caller.signal,sourceTimeoutMs:5000,requestTimeoutMs:5,requestIntervalMs:0})}catch(error){caught=error}
 assert.equal(caught,reason);assert.equal(state.readers,0);assert.equal(state.cancels,1);assert.equal(state.settled,true)
 if(reason)assert.deepEqual(Object.keys(reason),['opaque'])
})

for(const status of [200,403])test('final post-close audit work retains source ceiling with '+status+' priority',async()=>{
 const fake=async url=>({status,url:url==='https://www.valutico.com/'?'https://valutico.com/':url,headers:new Headers({'content-type':'text/html'}),body:new Response('<html><title>Unbound publisher</title></html>').body})
 let baseline;try{await runCurrentValutico({fetchImpl:fake,sourceTimeoutMs:1000,requestIntervalMs:0})}catch(error){baseline=error}
 if(status===403)assert.equal(baseline.httpStatus,403);else assert.equal(baseline.code,'VALUTICO_CURRENT_HOLD')
 const original=Object.defineProperty,descriptor=Object.getOwnPropertyDescriptor(performance,'now'),realNow=performance.now.bind(performance)
 let copies=0,jumped=0,caught
 original(performance,'now',{value:()=>realNow()+jumped,configurable:true})
 Object.defineProperty=function(target,key,value){
  const result=original(target,key,value)
  if(target instanceof Error&&key==='nativeCollectionEvidence'&&++copies===2)jumped=2000
  return result
 }
 try{try{await runCurrentValutico({fetchImpl:fake,sourceTimeoutMs:1000,requestIntervalMs:0})}catch(error){caught=error}}
 finally{Object.defineProperty=original;if(descriptor)original(performance,'now',descriptor);else delete performance.now}
 assert.ok(copies>=2);if(status===403)assert.equal(caught.httpStatus,403);else assert.equal(caught.name,'TimeoutError')
})
