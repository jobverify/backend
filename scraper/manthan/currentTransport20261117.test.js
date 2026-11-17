import assert from'node:assert/strict'
import test from'node:test'
import{currentTransport as manthan}from'./currentTransport20261117.js'
import{currentTransport as pepperfry}from'../pepperfry/currentTransport20261117.js'
import{currentTransport as sattvamedia}from'../sattvamedia/currentTransport20261117.js'
for(const[source,create]of Object.entries({manthan,pepperfry,sattvamedia})){
 const url=source==='sattvamedia'?'https://www.sattva.co.in/join-us/':source==='pepperfry'?'https://www.pepperfry.com/':'https://manthan.com/',response=(body='native',status=200,type='text/html')=>Object.defineProperty(new Response(body,{status,headers:{'content-type':type}}),'url',{value:url})
 test(source+' rejects malformed MIME prefixes/suffixes while accepting exact parameterized media types',async()=>{
  for(const[kind,mime]of[['html','text/htmlx'],['html','xtext/html'],['js','xapplication/javascript'],['js','application/javascriptx'],['json','xapplication/json'],['json','application/jsonx']]){const io=create({label:source,allowedURL:u=>u===url,requestIntervalMs:0,fetchImpl:async()=>response('{"native":true}',200,mime)})
   try{await assert.rejects(io.read(url,kind),/MIME/)}finally{io.close()}
  }
  for(const[kind,mime]of[['html','text/html; charset=utf-8'],['js','APPLICATION/JAVASCRIPT; charset=utf-8'],['json','application/problem+json; charset=utf-8']]){const io=create({label:source,allowedURL:u=>u===url,requestIntervalMs:0,fetchImpl:async()=>response('{"native":true}',200,mime)});try{await io.read(url,kind)}finally{io.close()}}
 })
 test(source+' checks request elapsed time after synchronous native JSON decode',async t=>{
  let clock=0;const parse=JSON.parse;t.mock.method(performance,'now',()=>clock);t.mock.method(JSON,'parse',(text,...args)=>{const value=parse(text,...args);if(text==='{"native":true}')clock=26000;return value})
  const io=create({label:source,allowedURL:u=>u===url,requestIntervalMs:0,fetchImpl:async()=>response('{"native":true}',200,'application/json')})
  try{await assert.rejects(io.read(url,'json'),e=>e.name==='TimeoutError'&&e.message===source+' request deadline exceeded')}finally{io.close();t.mock.restoreAll()}
 })
 test(source+' exact opaque/null/TimeoutError caller pacing and local source deadline never allow a second fetch',async()=>{
  for(const mode of['opaque','null','caller-timeout','local-timeout']){const caller=new AbortController(),reason=mode==='null'?null:Object.freeze({owner:source+'-pace'}),deadline=mode==='caller-timeout'?AbortSignal.timeout(40):null;let reads=0,timer
   const io=create({label:source,allowedURL:u=>u===url,requestIntervalMs:1000,timeoutMs:mode==='local-timeout'?40:180000,signal:deadline??caller.signal,fetchImpl:async()=>{reads++;return response()}})
   try{await io.read(url);if(['opaque','null'].includes(mode))timer=setTimeout(()=>caller.abort(reason),40);await assert.rejects(io.read(url),e=>mode==='local-timeout'?e.name==='TimeoutError'&&e.message===source+' source deadline exceeded':e===(deadline??caller.signal).reason);assert.equal(reads,1)}finally{clearTimeout(timer);io.close()}
  }
 })
 test(source+' unserviced synchronous source deadline and observed HTTP denial retain correct precedence',async t=>{
  for(const status of[200,403]){let clock=0;t.mock.method(performance,'now',()=>clock);const io=create({label:source,allowedURL:u=>u===url,timeoutMs:10,requestIntervalMs:0,fetchImpl:()=>{clock=35;return response('native',status)}})
   try{await assert.rejects(io.read(url),e=>status===403?e.httpStatus===403&&e.failureKind==='blocked_or_access_denied':e.name==='TimeoutError'&&e.message===source+' source deadline exceeded')}finally{io.close();t.mock.restoreAll()}
  }
 })
 test(source+' bounded reader cleanup preserves a later frozen opaque caller abort',async()=>{
  const caller=new AbortController(),reason=Object.freeze({owner:source+'-cleanup'}),timer=setTimeout(()=>caller.abort(reason),40),io=create({label:source,allowedURL:u=>u===url,signal:caller.signal,timeoutMs:10,requestIntervalMs:0,fetchImpl:async()=>response(new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>new Promise(()=>{})}))})
  try{await assert.rejects(io.read(url),e=>e===reason)}finally{clearTimeout(timer);io.close()}
 })
}
