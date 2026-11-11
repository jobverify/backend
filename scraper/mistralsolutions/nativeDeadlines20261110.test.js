import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createNativeMistralScraper} from './nativeRun.js'
import {CAREERS} from './nativeModels.js'
import {getEventListeners} from 'node:events'

const native=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/mistral-native-documents.json.gz',import.meta.url))))
const original=url=>{
 const packet=native.packets.find(packet=>packet.requestedURL===url)
 assert.ok(packet,'Existing authentic native fixture URL required')
 return{...packet,bytes:Buffer.from(packet.bodyBase64||packet.bodyText,packet.bodyBase64?'base64':'utf8')}
}
const bounded=async(options,validate,after=()=>{})=>{
 const controller=new AbortController(),escape=Symbol('test escape');let timer
 const result=createNativeMistralScraper().run({...options,signal:controller.signal})
 try{
  const value=await Promise.race([result.then(value=>({value}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve(escape),1000)})])
  assert.notEqual(value,escape,'Native source/request deadline must settle without caller cancellation')
  assert.ok(value.error,'Native acquisition must reject rather than publish after its deadline')
  validate(value.error)
 }finally{clearTimeout(timer);controller.abort(Error('test cleanup'));await after();await result.catch(()=>{})}
}

for(const callback of ['fetchResponse','fetchText'])for(const scope of ['source','request'])test('Mistral bounds ignored '+callback+' using '+scope+' deadline before fixture parsing',async()=>{
 let calls=0
 await bounded({sourceTimeoutMs:scope==='source'?15:1000,requestTimeoutMs:scope==='request'?15:1000,
  [callback]:()=>{calls++;return new Promise(()=>{})}},error=>assert.equal(error.code,scope==='source'?'MISTRAL_SOURCE_TIMEOUT':'MISTRAL_REQUEST_TIMEOUT'))
 assert.equal(calls,1)
})

test('Mistral bounds an ignored binary callback after genuine native careers/contact parsing',async()=>{
 let binary=0
 await bounded({sourceTimeoutMs:2000,requestTimeoutMs:20,fetchText:async url=>original(url).bytes.toString('utf8'),fetchBytes:()=>{binary++;return new Promise(()=>{})}},error=>assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT'))
 assert.equal(binary,1)
})

test('Mistral default fetch is independently raced when it ignores its signal',async()=>{
 const previous=globalThis.fetch;let calls=0
 try{globalThis.fetch=()=>{calls++;return new Promise(()=>{})}
  await bounded({sourceTimeoutMs:1000,requestTimeoutMs:15},error=>assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT'))
 }finally{globalThis.fetch=previous}
 assert.equal(calls,1)
})

test('Mistral default body acquisition is independently raced and closes its original reader',async()=>{
 const previous=globalThis.fetch;let cancelled=0,released=0,unblock
 const body={cancel:()=>{cancelled++;unblock?.({done:true})},getReader:()=>({read:()=>new Promise(resolve=>{unblock=resolve}),cancel:()=>{cancelled++;unblock?.({done:true})},releaseLock:()=>{released++}}),[Symbol.asyncIterator]:()=>({next:()=>new Promise(resolve=>{unblock=resolve})})}
 try{globalThis.fetch=async url=>({url,status:200,headers:{get:()=> 'text/html'},body})
  await bounded({sourceTimeoutMs:1000,requestTimeoutMs:15},error=>assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT'),async()=>{if(!cancelled)await body.cancel()})
 }finally{globalThis.fetch=previous}
 assert.equal(cancelled,1);assert.equal(released,1)
})

for(const scope of ['source','request'])test('Mistral '+scope+' monotonic deadline rejects a synchronous callback stall',async()=>{
 await bounded({sourceTimeoutMs:scope==='source'?20:1000,requestTimeoutMs:scope==='request'?15:1000,fetchResponse:()=>{
  const start=performance.now();while(performance.now()-start<40){/* emulate a blocked event loop */}return original(CAREERS)
 }},error=>assert.equal(error.code,scope==='source'?'MISTRAL_SOURCE_TIMEOUT':'MISTRAL_REQUEST_TIMEOUT'))
})

for(const callback of ['fetchResponse','fetchText'])test('Mistral exact caller cancellation takes priority for '+callback,async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'Mistral exact reason'});let callbackSignal,calls=0
 const pending=createNativeMistralScraper().run({signal:controller.signal,sourceTimeoutMs:1000,requestTimeoutMs:1000,[callback]:(_url,{signal})=>{
  callbackSignal=signal;calls++;queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})
 }})
 await assert.rejects(pending,error=>error===reason)
 assert.equal(calls,1);assert.equal(callbackSignal.reason,reason);assert.equal(getEventListeners(controller.signal,'abort').length,0)
})

test('Mistral pre-aborted caller keeps its exact reason and performs no acquisition',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'before native I/O'});controller.abort(reason)
 await assert.rejects(createNativeMistralScraper().run({signal:controller.signal,fetchResponse:()=>assert.fail('must not acquire')}),error=>error===reason)
})

test('Mistral cancels a late default fetch body exactly once after request expiry',async()=>{
 const previous=globalThis.fetch;let resolveFetch,cancelled=0,reads=0
 try{globalThis.fetch=()=>new Promise(resolve=>{resolveFetch=resolve})
  await bounded({sourceTimeoutMs:1000,requestTimeoutMs:15},error=>assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT'))
  resolveFetch({url:CAREERS,status:200,headers:{get:()=> 'text/html'},body:{cancel:()=>{cancelled++},getReader:()=>{reads++;assert.fail('expired response must not be consumed')}}})
  await new Promise(resolve=>setImmediate(resolve))
 }finally{globalThis.fetch=previous}
 assert.equal(cancelled,1);assert.equal(reads,0)
})

test('Mistral consumes a late callback rejection after bounded source termination',async()=>{
 let rejectFetch
 await bounded({sourceTimeoutMs:15,requestTimeoutMs:1000,fetchResponse:()=>new Promise((_,reject)=>{rejectFetch=reject})},error=>assert.equal(error.code,'MISTRAL_SOURCE_TIMEOUT'))
 rejectFetch(Error('late producer failure'));await new Promise(resolve=>setImmediate(resolve))
})

test('Mistral consumes and cancels a late original response packet body after callback expiry',async()=>{
 let resolveFetch,cancelled=0
 await bounded({sourceTimeoutMs:1000,requestTimeoutMs:15,fetchResponse:()=>new Promise(resolve=>{resolveFetch=resolve})},error=>assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT'))
 resolveFetch({...original(CAREERS),body:{cancel:()=>{cancelled++}}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1)
})

test('Mistral monotonic request guard also checks a synchronously delayed callback rejection',async()=>{
 await bounded({sourceTimeoutMs:1000,requestTimeoutMs:15,fetchResponse:()=>{
  const started=performance.now();while(performance.now()-started<40){/* block timer delivery before failure */}throw Error('late native failure')
 }},error=>assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT'))
})

test('Mistral preserves async-iterator body support with bounded next and nonblocking cleanup',async()=>{
 const previous=globalThis.fetch;let cancelled=0,returned=0
 try{globalThis.fetch=async url=>({url,status:200,headers:{get:()=> 'text/html'},body:{
  cancel:()=>{cancelled++;return new Promise(()=>{})},
  [Symbol.asyncIterator]:()=>({
   next:()=>new Promise(()=>{}),
   return:()=>{returned++;return new Promise(()=>{})},
  }),
 }})
  await bounded({sourceTimeoutMs:1000,requestTimeoutMs:15},error=>assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT'))
 }finally{globalThis.fetch=previous}
 assert.equal(cancelled,1);assert.equal(returned,1)
})

for(const mode of ['failure','synchronous stall','oversized bytes'])test('Mistral default reader closes exactly once after '+mode,async()=>{
 const previous=globalThis.fetch,failure=Error('original native body failed');let cancelled=0,released=0,reads=0
 try{
  const body={getReader:()=>({read:()=>{
   reads++
   if(mode==='failure')return Promise.reject(failure)
   if(mode==='synchronous stall'){const start=performance.now();while(performance.now()-start<40){/* native read stalls event loop */}return Promise.resolve({done:false,value:Uint8Array.from([65])})}
   return Promise.resolve({done:false,value:new Uint8Array(4000001)})
  },cancel:()=>{cancelled++},releaseLock:()=>{released++}})}
  globalThis.fetch=async url=>({url,status:200,headers:{get:()=> 'text/html'},body})
  await bounded({sourceTimeoutMs:1000,requestTimeoutMs:mode==='synchronous stall'?15:100},error=>{
   if(mode==='failure')assert.equal(error,failure)
   else if(mode==='synchronous stall')assert.equal(error.code,'MISTRAL_REQUEST_TIMEOUT')
   else assert.match(error.message,/bounded public body required/)
  })
 }finally{globalThis.fetch=previous}
 assert.equal(cancelled,1);assert.equal(released,1);assert.equal(reads,1)
})

for(const options of [{sourceTimeoutMs:0},{sourceTimeoutMs:Infinity},{sourceTimeoutMs:180001},{requestTimeoutMs:0},{requestTimeoutMs:30001}])test('Mistral rejects unbounded or invalid duration before native I/O '+JSON.stringify(options),async()=>{
 await assert.rejects(createNativeMistralScraper().run({...options,fetchResponse:()=>assert.fail('invalid deadline must not acquire')}),RangeError)
})

test('Mistral genuine successful52-response replay closes all request signals and source timers',async()=>{
 const controller=new AbortController(),signals=[],activeTimers=new Set(),start=globalThis.setTimeout,stop=globalThis.clearTimeout
 globalThis.setTimeout=(...args)=>{const handle=start(...args);activeTimers.add(handle);return handle}
 globalThis.clearTimeout=handle=>{activeTimers.delete(handle);return stop(handle)}
 try{
  const jobs=await createNativeMistralScraper().run({signal:controller.signal,fetchResponse:async(url,{signal})=>{signals.push(signal);return original(url)}})
  assert.equal(jobs.length,25);assert.equal(signals.length,52);assert.ok(signals.every(signal=>signal.aborted))
  assert.equal(activeTimers.size,0);assert.equal(getEventListeners(controller.signal,'abort').length,0)
  assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
  assert.equal(jobs[0].nativeRunEvidence.wholeOpeningClosingDocumentsReconciled,true)
 }finally{globalThis.setTimeout=start;globalThis.clearTimeout=stop;controller.abort()}
})
