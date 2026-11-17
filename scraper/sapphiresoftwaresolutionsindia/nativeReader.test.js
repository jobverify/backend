import assert from 'node:assert/strict'
import test from 'node:test'
import {setImmediate as immediate} from 'node:timers/promises'
import {createSapphireNativeReader,CAREERS,LIST} from './nativeReader20261117.js'
const create=options=>createSapphireNativeReader({requestTimeoutMs:100,sourceTimeoutMs:2000,...options})
const response=(status=200,body='original',url=CAREERS,headers={})=>({status,url,body:new Response(body).body,headers:new Headers({'content-type':'text/html',...headers})})

for(const mode of ['source-deadline','caller'])test('Sapphire pacing preserves '+mode+' without another native request',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'sapphire',stage:'pacing'});let calls=0,timer
 const reader=create({signal:controller.signal,sourceTimeoutMs:mode==='source-deadline'?300:2000,fetchImpl:async()=>{calls++;return response()}})
 if(mode==='caller')timer=setTimeout(()=>controller.abort(reason),300)
 try{
  await reader.read(CAREERS)
  await assert.rejects(reader.read(CAREERS),error=>mode==='caller'?error===reason:error.name==='TimeoutError'&&/source deadline/.test(error.message))
  assert.equal(calls,1)
 }finally{clearTimeout(timer);reader.close()}
})
async function rejected(reader,url,predicate){try{await assert.rejects(reader.read(url),predicate)}finally{reader.close()}}
for(const mode of ['fulfilled','rejected'])test('Sapphire exact frozen caller reason survives in-flight '+mode+' response',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,mode});let cancels=0
 const reader=create({signal:controller.signal,fetchImpl:async()=>{controller.abort(reason);if(mode==='rejected')throw Object.freeze(Error('replacement'));return response(200,new ReadableStream({cancel(){cancels++}}))}})
 await rejected(reader,CAREERS,error=>error===reason)
 if(mode==='fulfilled'){await immediate();assert.equal(cancels,1)}
})
test('Sapphire frozen pre-abort starts no transport or body-only callback',()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true});controller.abort(reason);let calls=0
 assert.throws(()=>create({signal:controller.signal,fetchText:()=>{calls++}}),error=>error===reason);assert.equal(calls,0)
})
test('Sapphire observed403 outranks stalled error body and non-settling disposal',async()=>{
 let reads=0,cancels=0
 const reader=create({fetchImpl:async()=>({status:403,url:CAREERS,headers:new Headers({'content-type':'text/html'}),body:{getReader(){reads++;return {read:()=>new Promise(()=>{})}},cancel(){cancels++;return new Promise(()=>{})}}})})
 await rejected(reader,CAREERS,error=>error.status===403&&error.failureKind==='blocked_or_access_denied');await immediate()
 assert.equal(reads,0);assert.equal(cancels,1);assert.equal(reader.stats().receipts[0].status,403);assert.equal(reader.stats().receipts[0].bodyComplete,false)
})
for(const [status,headers]of [[202,{'x-amzn-waf-action':'challenge'}],[200,{'cf-mitigated':'challenge'}]])test('Sapphire native'+status+' WAF challenge remains a held denial',async()=>{
 const reader=create({fetchImpl:async()=>response(status,'original',CAREERS,headers)})
 await rejected(reader,CAREERS,error=>error.failureKind==='blocked_or_access_denied'&&error.accessChallenge===true)
 assert.equal(reader.stats().receipts[0].bodyComplete,false)
})
test('Sapphire foreign response authority stays a hard error even on403',async()=>{
 const reader=create({fetchImpl:async()=>response(403,'denied','https://foreign.example/')})
 await rejected(reader,CAREERS,error=>error.failureKind==='parser_or_contract_error'&&error.softFailure===false)
})
test('Sapphire bodyless native POST preserves exact method, native JSON and absent body',async()=>{
 const reader=create({fetchImpl:async(url,init)=>{assert.equal(url,LIST);assert.equal(init.method,'POST');assert.equal(init.body,undefined);assert.equal(init.headers['Content-Type'],undefined);return response(200,'{"vacancyList":[]}',LIST,{'content-type':'application/json'})}})
 try{assert.equal((await reader.read(LIST)).body,'{"vacancyList":[]}');assert.equal(reader.stats().receipts[0].requestBodyPresent,false)}finally{reader.close()}
})
test('Sapphire timeout keeps already observed200 headers and disposes a stalled stream',async()=>{
 let cancels=0
 const reader=create({requestTimeoutMs:20,fetchImpl:async()=>response(200,new ReadableStream({pull:()=>new Promise(()=>{}),cancel(){cancels++}}))})
 await rejected(reader,CAREERS,error=>error.name==='TimeoutError');await immediate();assert.equal(cancels,1);assert.equal(reader.stats().receipts[0].status,200)
})
test('Sapphire late successful fetch after deadline disposes its unread response',async()=>{
 let resolve,cancels=0;const pending=new Promise(done=>{resolve=done}),reader=create({requestTimeoutMs:20,fetchImpl:()=>pending})
 await rejected(reader,CAREERS,error=>error.name==='TimeoutError')
 resolve(response(200,new ReadableStream({cancel(){cancels++}})));await immediate();assert.equal(cancels,1)
})
test('Sapphire frozen ordinary transport failure retains exact identity',async()=>{
 const reason=Object.freeze(Error('original transport')),reader=create({fetchImpl:async()=>{throw reason}})
 await rejected(reader,CAREERS,error=>error===reason)
})
test('Sapphire streaming overflow cancels and releases the original reader',async()=>{
 let cancels=0;const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(16*1024*1024));controller.enqueue(new Uint8Array(1))},cancel(){cancels++}})
 const reader=create({fetchImpl:async()=>response(200,stream)})
 await rejected(reader,CAREERS,/16MiB/);await immediate();assert.equal(cancels,1);assert.equal(stream.locked,false)
})
test('Sapphire frozen opaque caller abort during body read disposes and releases the original stream',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,phase:'body'});let cancels=0
 const stream=new ReadableStream({pull(){controller.abort(reason);return new Promise(()=>{})},cancel(received){assert.equal(received,reason);cancels++}},{highWaterMark:0})
 const reader=create({signal:controller.signal,fetchImpl:async()=>response(200,stream)})
 await rejected(reader,CAREERS,error=>error===reason);await immediate();assert.equal(cancels,1);assert.equal(stream.locked,false)
})
