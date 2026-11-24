import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runIkeaNative} from './currentNative.js'
import {createIkeaTransport} from './nativeTransport20261121.js'
import {createHash} from 'node:crypto'
const CAREERS='https://www.ikea.com/global/en/jobs/',fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-http.json.gz',import.meta.url)))),pause=ms=>new Promise(r=>setTimeout(r,ms))
const errorOf=async p=>{try{await p;return{resolved:true}}catch(error){return{error}}}
for(const status of[403,429])test('IKEA observes '+status+' before body admission and awaits bounded cancellation',async t=>{
 let readers=0,cancelled=false,calls=0
 t.mock.method(globalThis,'fetch',async()=>{calls++;return{status,url:CAREERS,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('Body must not open')},async cancel(){await pause(15);cancelled=true}}}})
 const out=await errorOf(runIkeaNative());assert.equal(out.resolved,undefined);assert.equal(out.error.httpStatus??out.error.status,status);assert.match(out.error.message,new RegExp('HTTP.*'+status,'i'));assert.equal(readers,0);assert.equal(cancelled,true);assert.equal(calls,1)
})
test('IKEA challenge202 is classified before a reader opens',async t=>{
 let readers=0,cancels=0;t.mock.method(globalThis,'fetch',async()=>({status:202,url:CAREERS,headers:new Headers({'content-type':'text/html','x-amzn-waf-action':'challenge'}),body:{getReader(){readers++;throw Error('challenge body must not open')},cancel(){cancels++;return Promise.resolve()}}}))
 const out=await errorOf(runIkeaNative());assert.equal(out.error.httpStatus??out.error.status,202);assert.equal(out.error.accessChallenge,true);assert.equal(readers,0);assert.equal(cancels,1)
})
test('observed429 survives local request/source deadlines during nonsettling denial cleanup',async t=>{
 let readers=0;t.mock.method(globalThis,'fetch',async()=>({status:429,url:CAREERS,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;return{read(){return new Promise(()=>{})},cancel(){return new Promise(()=>{})}}},cancel(){return new Promise(()=>{})}}}))
 const out=await errorOf(runIkeaNative({requestTimeoutMs:20,timeoutMs:40}));assert.equal(out.error.httpStatus??out.error.status,429);assert.match(out.error.message,/HTTP.*429/i);assert.equal(readers,0)
})

test('foreign403 identity is retained as a contract hold before body admission',async t=>{
 let readers=0;t.mock.method(globalThis,'fetch',async()=>({status:403,url:'https://foreign.invalid/jobs',headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('foreign body must not open')},cancel(){return Promise.resolve()}}}))
 const out=await errorOf(runIkeaNative());assert.equal(out.error.failureKind,'parser_or_contract_error');assert.equal(out.error.softFailure,false);assert.equal(readers,0)
})
test('a late native response after request deadline is canceled and awaited within close grace',async t=>{
 let readers=0,cancelled=false;t.mock.method(globalThis,'fetch',()=>new Promise(resolve=>setTimeout(()=>resolve({status:200,url:CAREERS,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('late response must not open')},async cancel(){await pause(15);cancelled=true}}}),25)))
 const out=await errorOf(runIkeaNative({requestTimeoutMs:10,timeoutMs:1000}));assert.equal(out.error.name,'TimeoutError');assert.equal(cancelled,true);assert.equal(readers,0)
})
for(const [label,reason]of[['frozen',Object.freeze({opaque:'IKEA delayed disposal'})],['null',null]])test('exact '+label+' caller wins while read-error cancellation settles',async t=>{
 const caller=new AbortController();let finished=false;t.mock.method(globalThis,'fetch',async()=>({status:200,url:CAREERS,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{read(){throw Error('primary read failure')},async cancel(){await pause(15);caller.abort(reason);finished=true}}}}}))
 const out=await errorOf(runIkeaNative({signal:caller.signal}));await pause(20);assert.equal(caller.signal.aborted,true);assert.equal(finished,true);assert.equal(out.error===reason,true,'Exact caller reason must win after awaited cleanup')
})
for(const [label,reason]of[['frozen',Object.freeze({opaque:'IKEA close'})],['null',null]])for(const mode of['success','identity','403'])test('final source '+mode+' close preserves '+label+' caller reason',async t=>{
 const caller=new AbortController();let calls=0,closingTriggered=false,audited=false
 t.mock.method(globalThis,'fetch',async(input,init)=>{const url=String(input),row=fixture.responses.find(r=>r.url===url);assert.ok(row,'Offline historical tripwire');if(calls++===0)init.signal.addEventListener('abort',()=>{closingTriggered=true;caller.abort(reason)},{once:true});const html=mode==='identity'&&url===CAREERS?row.body.replace('</h1>','Different employer</h1>'):row.body;if(mode==='identity'&&url===CAREERS)assert.notEqual(html,row.body);const response=new Response(html,{status:mode==='403'&&url===CAREERS?403:row.status,headers:{'content-type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalURL});return response})
 const out=await errorOf(runIkeaNative({signal:caller.signal,onAudit:()=>{audited=true}}));if(mode==='success')assert.equal(audited,true,'Complete native closing/audit must precede source success close');assert.equal(closingTriggered,true);assert.equal(out.error===reason,true,'Exact caller reason must win after controller close');assert.equal(caller.signal.aborted,true)
})
test('native entity overflow awaits reader cleanup without accepting bytes beyond cap',async t=>{
 let cancelled=false;t.mock.method(globalThis,'fetch',async()=>({status:200,url:CAREERS,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{async read(){return{done:false,value:new Uint8Array(4000001)}},async cancel(){await pause(15);cancelled=true}}}}}))
 const out=await errorOf(runIkeaNative());assert.match(out.error.message,/byte cap/);assert.equal(cancelled,true)
})

test('retained native JSON search response with its declared Accept class remains admitted',async()=>{
 const row=fixture.responses.find(r=>r.contentType.startsWith('application/json'));assert.ok(row)
 const io=createIkeaTransport({fetchImpl:async url=>{assert.equal(url,row.url);return Object.defineProperty(new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}}),'url',{value:row.finalURL})}})
 try{let page,error;try{page=await io.readPage(row.url,{signal:new AbortController().signal,headers:{Accept:'application/json'},receipt:{}})}catch(e){error=e}
 assert.equal(error?.message??null,null);assert.equal(createHash('sha256').update(page.html).digest('hex'),row.bodySHA256)
 }finally{await io.close()}
})
for(const [label,accept,mime]of[['HTML','text/html','text/html+xml'],['JavaScript','application/javascript','application/x-javascript-suffix']])test(label+' media subtype suffix holds before any reader opens',async()=>{
 const row=fixture.responses.find(r=>label==='HTML'?r.url===CAREERS:r.contentType.startsWith('application/x-javascript'));assert.ok(row)
 let readers=0;const io=createIkeaTransport({fetchImpl:async()=>{const response=Object.defineProperty(new Response(row.body,{status:row.status,headers:{'content-type':mime}}),'url',{value:row.finalURL}),body=response.body,getReader=body.getReader.bind(body);body.getReader=(...args)=>{readers++;return getReader(...args)};return response}})
 try{let error;try{await io.readPage(row.url,{signal:new AbortController().signal,headers:{Accept:accept},receipt:{}})}catch(e){error=e}assert.equal(readers,0);assert.match(error.message,/MIME changed/)}finally{await io.close()}
})
