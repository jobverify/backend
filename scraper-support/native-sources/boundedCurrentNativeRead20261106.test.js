import assert from 'node:assert/strict'
import test from 'node:test'
import {setImmediate as immediate} from 'node:timers/promises'
import {createCurrentNativeReader} from './boundedCurrentNativeRead20261106.js'

const URL='https://native.example/careers'
const create=options=>createCurrentNativeReader({sourceTimeoutMs:2000,requestTimeoutMs:150,...options},{source:'native-http-regression',admitted:[[URL,'html']]})
function response({status=200,url=URL,headers={},text='<main>Original native criteria</main>',mode='complete',cancel=()=>{}}={}){
 const counts={reads:0,cancels:0,releases:0};let done=false
 const body={cancel(){counts.cancels++;return cancel()},getReader(){return{
  read(){counts.reads++;if(mode==='stalled')return new Promise(()=>{});if(mode==='broken')throw Error('Broken native entity');if(done)return Promise.resolve({done:true});done=true;return Promise.resolve({done:false,value:Buffer.from(text)})},
  cancel(){counts.cancels++;return cancel()},releaseLock(){counts.releases++},
 }}}
 return {counts,value:{status,url,headers:new Headers({'content-type':'text/html; charset=utf-8',...headers}),body,bodyUsed:false}}
}
async function rejected(reader,predicate){try{await assert.rejects(reader.read(URL),predicate)}finally{reader.close()}}
for(const mode of ['stalled','broken'])test('known403 takes priority over '+mode+' body and preserves header receipt',async()=>{
 const native=response({status:403,mode,cancel:()=>new Promise(()=>{})}),reader=create({fetchImpl:async()=>native.value})
 await rejected(reader,error=>error.status===403&&error.failureKind==='blocked_or_access_denied'&&error.softFailure===true)
 const receipt=reader.stats().receipts[0]
 assert.equal(receipt.status,403);assert.equal(receipt.finalUrl,URL);assert.equal(receipt.headers['content-type'],'text/html; charset=utf-8');assert.equal(receipt.bodyComplete,false)
 assert.equal(Object.hasOwn(receipt,'sha256'),false);assert.equal(native.counts.reads,0);await immediate();assert.equal(native.counts.cancels,1)
})
for(const [status,headers]of [[202,{'x-amzn-waf-action':'challenge'}],[200,{'cf-mitigated':'challenge'}]])test('native'+status+' challenge headers cannot admit a valid-looking200 body',async()=>{
 const native=response({status,headers}),reader=create({fetchImpl:async()=>native.value})
 await rejected(reader,error=>error.status===status&&error.accessChallenge===true&&error.failureKind==='blocked_or_access_denied')
 assert.equal(reader.stats().receipts[0].status,status);assert.equal(reader.stats().receipts[0].bodyComplete,false);assert.equal(native.counts.reads,0)
})
for(const [status,kind]of [[202,'upstream_response_pending'],[429,'blocked_or_access_denied'],[503,'network_or_timeout'],[404,'parser_or_contract_error']])test('native HTTP'+status+' retains its HTTP classification before entity reads',async()=>{
 const native=response({status,mode:'stalled',headers:{'retry-after':'7'}}),reader=create({fetchImpl:async()=>native.value})
 await rejected(reader,error=>error.status===status&&error.failureKind===kind&&error.lifecycleCleanupAllowed===false)
 assert.equal(native.counts.reads,0);assert.equal(reader.stats().receipts[0].status,status)
})
for(const status of [200,403])test('different response authority remains a hard contract error before HTTP'+status+' body',async()=>{
 const native=response({status,url:'https://other.example/careers',mode:'stalled'}),reader=create({fetchImpl:async()=>native.value})
 await rejected(reader,error=>error.status===status&&error.failureKind==='parser_or_contract_error'&&error.softFailure===false)
 assert.equal(reader.stats().receipts[0].finalUrl,'https://other.example/careers');assert.equal(native.counts.reads,0)
})
test('successful original200 retains the exact decoded native body and complete receipt',async()=>{
 const text='<main>Actual native field: graduate degree</main>',native=response({text}),reader=create({fetchImpl:async()=>native.value})
 try{assert.equal((await reader.read(URL)).body,text);const receipt=reader.stats().receipts[0];assert.equal(receipt.status,200);assert.equal(receipt.bodyComplete,true);assert.equal(receipt.bytes,Buffer.byteLength(text));assert.match(receipt.sha256,/^[a-f0-9]{64}$/)}finally{reader.close()}
})
test('a200 stalled body remains a timeout while preserving its already observed headers',async()=>{
 const native=response({mode:'stalled'}),reader=create({fetchImpl:async()=>native.value})
 await rejected(reader,error=>error.name==='TimeoutError')
 assert.equal(reader.stats().receipts[0].status,200);assert.equal(reader.stats().receipts[0].bodyComplete,false)
})
test('a200 unsupported MIME remains a contract failure after a complete bounded native entity',async()=>{
 const native=response({headers:{'content-type':'application/json'},text:'{"items":[]}'}),reader=create({fetchImpl:async()=>native.value})
 await rejected(reader,/MIME changed/);assert.equal(reader.stats().receipts[0].status,200);assert.equal(reader.stats().receipts[0].bodyComplete,true)
})
test('metadata callback known403 outranks unavailable body without manufacturing an empty entity',async()=>{
 const reader=create({fetchPage:async()=>({status:403,url:URL,headers:{'content-type':'text/html'},bodyUnavailable:true})})
 await rejected(reader,error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
 assert.equal(reader.stats().receipts[0].status,403);assert.equal(reader.stats().receipts[0].bodyComplete,false)
})
test('metadata callback200 still requires its complete original body',async()=>{
 const reader=create({fetchPage:async()=>({status:200,url:URL,headers:{'content-type':'text/html'},bodyUnavailable:true})})
 await rejected(reader,/unavailable|Missing/i);assert.equal(reader.stats().receipts[0].status,200);assert.equal(reader.stats().receipts[0].bodyComplete,false)
})
test('original metadata callbacks retain their complete successful200 representation',async()=>{
 const text='<main>Native callback model</main>',reader=create({fetchPage:async()=>({status:200,finalUrl:URL,headers:{'content-type':'text/html'},body:text})})
 try{assert.equal((await reader.read(URL)).body,text);assert.equal(reader.stats().receipts[0].bodyComplete,true)}finally{reader.close()}
})
test('HTTP denial remains primary if a local source deadline expires during header inspection',async()=>{
 const native=response({status:403});Object.defineProperty(native.value,'headers',{get(){const end=performance.now()+15;while(performance.now()<end){/* synchronous native header read */}return new Headers({'content-type':'text/html'})}})
 const reader=create({sourceTimeoutMs:5,requestTimeoutMs:100,fetchImpl:async()=>native.value})
 await rejected(reader,error=>error.status===403&&error.failureKind==='blocked_or_access_denied');assert.equal(native.counts.reads,0)
})
for(const mode of ['fulfilled','rejected'])test('exact frozen opaque caller abort wins over '+mode+' native HTTP headers',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,caller:'native-reader',mode}),native=response({status:403})
 const reader=create({signal:controller.signal,fetchImpl:async()=>{controller.abort(reason);if(mode==='rejected')throw Object.freeze(Error('Replacement native failure'));return native.value}})
 await rejected(reader,error=>error===reason);assert.equal(native.counts.reads,0)
})
test('exact frozen opaque pre-abort starts no native callback',()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,caller:'pre-abort'});controller.abort(reason);let calls=0
 assert.throws(()=>create({signal:controller.signal,fetchImpl:async()=>{calls++}}),error=>error===reason);assert.equal(calls,0)
})
test('caller abort during non-settling error-body disposal preserves exact caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,caller:'dispose'}),native=response({status:403,mode:'stalled',cancel:()=>{controller.abort(reason);return new Promise(()=>{})}})
 const reader=create({signal:controller.signal,fetchImpl:async()=>native.value})
 await rejected(reader,error=>error===reason);assert.equal(native.counts.reads,0)
})
test('a frozen noncaller transport failure retains exact identity',async()=>{
 const reason=Object.freeze(Error('Native transport rejected')),reader=create({fetchImpl:async()=>{throw reason}})
 await rejected(reader,error=>error===reason)
})
test('declared read-only POST descriptor and returned native JSON remain unchanged',async()=>{
 let calls=0
 const reader=createCurrentNativeReader({fetchImpl:async(url,init)=>{calls++;assert.equal(url,URL);assert.equal(init.method,'POST');assert.equal(init.body,'action=publicList');assert.equal(init.headers['Content-Type'],'application/x-www-form-urlencoded; charset=UTF-8');const native=response({headers:{'content-type':'application/json'},text:'{"nativeRecords":[]}'});return native.value}},{source:'native-http-regression',admitted:[[URL,'json']],requests:[[URL,{method:'POST',body:'action=publicList'}]]})
 try{assert.equal((await reader.read(URL)).body,'{"nativeRecords":[]}');assert.equal(calls,1);assert.equal(reader.stats().receipts[0].method,'POST')}finally{reader.close()}
})

test('early HTTP validation retains the streaming byte ceiling and overflow disposal',async()=>{
 let cancels=0
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(16*1024*1024));controller.enqueue(new Uint8Array(1))},cancel(){cancels++}})
 const reader=create({fetchImpl:async()=>({status:200,url:URL,headers:new Headers({'content-type':'text/html'}),body:stream})})
 await rejected(reader,/byte budget/)
 assert.equal(cancels,1);assert.equal(stream.locked,false);assert.equal(reader.stats().receipts[0].status,200);assert.equal(reader.stats().receipts[0].bodyComplete,false)
})

test('early HTTP validation never relabels invalid native UTF8 as job text',async()=>{
 const reader=create({fetchImpl:async()=>({status:200,url:URL,headers:new Headers({'content-type':'text/html'}),body:new Response(new Uint8Array([0xff])).body})})
 await rejected(reader,/encoded data|encoding/i)
 assert.equal(reader.stats().receipts[0].bodyComplete,true)
})

test('a late successful response after a local deadline disposes its unread body',async()=>{
 let resolve,cancels=0
 const pending=new Promise(done=>{resolve=done}),reader=create({requestTimeoutMs:20,fetchImpl:()=>pending})
 await rejected(reader,error=>error.name==='TimeoutError')
 resolve({status:200,url:URL,headers:new Headers({'content-type':'text/html'}),body:new ReadableStream({cancel(){cancels++}})})
 await immediate();assert.equal(cancels,1)
})

test('source deadline during request pacing starts no extra native read',async()=>{
 let calls=0
 const reader=create({sourceTimeoutMs:100,fetchImpl:async()=>{calls++;return response().value}})
 try{
  await reader.read(URL)
  await assert.rejects(reader.read(URL),error=>error.name==='TimeoutError')
 }finally{reader.close()}
 assert.equal(calls,1)
})
