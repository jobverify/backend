import test from 'node:test'
import assert from 'node:assert/strict'
import {createValuticoReader} from './nativeTransport20261121.js'
const url='https://www.valutico.com/'
const response=(status=200,body='<html>Valutico</html>',headers={'content-type':'text/html'})=>Object.defineProperty(new Response(body,{status,headers}),'url',{value:url})
const options=fetchImpl=>({fetchImpl,requestIntervalMs:0})
test('metadata-first public GET retains original body and complete receipt',async()=>{
 let init
 const r=createValuticoReader(options(async(u,i)=>{assert.equal(u,url);init=i;return response()}))
 try{const row=await r.read(url);assert.equal(row.body,'<html>Valutico</html>');assert.equal(row.status,200);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(r.stats().requests,1);assert.equal(r.stats().receipts[0].bodyComplete,true)}finally{await r.close()}
})
for(const status of [403,429,202])test('known HTTP '+status+' admitted before any body reader and awaited cleanup',async()=>{
 let readers=0,cancels=0,settled=false
 const r=createValuticoReader(options(async()=>({status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('reader must not open')},async cancel(){cancels++;await new Promise(resolve=>setTimeout(resolve,20));settled=true}}})))
 try{await assert.rejects(r.read(url),e=>e.httpStatus===status);assert.equal(readers,0);assert.equal(cancels,1);assert.equal(settled,true);assert.equal(r.stats().receipts[0].status,status)}finally{await r.close()}
})
for(const [name,make] of [
 ['foreign final URL',()=>({...response(),status:200,url:'https://foreign.invalid/',headers:new Headers({'content-type':'text/html'}),body:null})],
 ['wrong MIME',()=>({status:200,url,headers:new Headers({'content-type':'application/json'})})]
])test(name+' refuses before body access',async()=>{
 let readers=0,cancels=0
 const value=make();value.body={getReader(){readers++;throw Error('no body')},async cancel(){cancels++}}
 const r=createValuticoReader(options(async()=>value))
 try{await assert.rejects(r.read(url));assert.equal(readers,0);assert.equal(cancels,1)}finally{await r.close()}
})
test('undeclared URL never reaches transport',async()=>{
 let calls=0;const r=createValuticoReader(options(async()=>{calls++;return response()}))
 try{await assert.rejects(r.read('https://foreign.invalid/'));assert.equal(calls,0)}finally{await r.close()}
})
test('metadata-aware page callback works but body-only callback never certifies a source',async()=>{
 const r=createValuticoReader({requestIntervalMs:0,fetchPage:async()=>({status:200,finalUrl:url,headers:{'content-type':'text/html'},body:'<h1>Valutico</h1>'})})
 try{assert.equal((await r.read(url)).body,'<h1>Valutico</h1>')}finally{await r.close()}
 assert.throws(()=>createValuticoReader({fetchText:async()=>'<h1>Valutico</h1>'}),/metadata/i)
})
for(const reason of [Object.freeze({opaque:'caller'}),null])test('preabort preserves exact '+(reason===null?'null':'frozen')+' caller',()=>{
 const c=new AbortController;c.abort(reason);let caught=Symbol()
 try{createValuticoReader({signal:c.signal,fetchText:async()=>''})}catch(e){caught=e}
 assert.equal(caught,reason)
})
for(const reason of [Object.freeze({opaque:'late caller'}),null])test('truly late fetch cleanup settles before exact '+(reason===null?'null':'frozen')+' caller returns',async()=>{
 const c=new AbortController;let readers=0,cancels=0,settled=false
 const r=createValuticoReader({...options(()=>new Promise(resolve=>setTimeout(()=>resolve({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('no body')},async cancel(){cancels++;await new Promise(done=>setTimeout(done,30));settled=true}}}),20))),signal:c.signal})
 const p=r.read(url);setTimeout(()=>c.abort(reason),5);let caught=Symbol()
 try{await p}catch(e){caught=e}finally{try{await r.close()}catch(e){assert.equal(e,reason)}}
 assert.equal(caught,reason);assert.equal(readers,0);assert.equal(cancels,1);assert.equal(settled,true)
})
for(const status of [403,429])test('observed late known'+status+' retains HTTP priority with zero readers and awaited disposal',async()=>{
 let readers=0,canceled=0,settled=false,requestSignal
 const r=createValuticoReader({...options((_url,init)=>(requestSignal=init.signal,new Promise(resolve=>setTimeout(()=>resolve({status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('no body reader')},async cancel(){canceled++;await new Promise(done=>setTimeout(done,20));settled=true}}}),25)))),requestTimeoutMs:10})
 try{await assert.rejects(r.read(url),e=>e.httpStatus===status);assert.equal(requestSignal.aborted,true);assert.equal(requestSignal.reason.name,'TimeoutError');assert.equal(requestSignal.reason.message,'Valutico request deadline exceeded');assert.equal(readers,0);assert.equal(canceled,1);assert.equal(settled,true);assert.equal(r.stats().receipts[0].status,status);assert.equal(r.stats().receipts[0].bodyComplete,false)}finally{await r.close()}
})
for(const status of [403,429])for(const reason of [Object.freeze({opaque:'caller over late HTTP'}),null])test('exact '+(reason===null?'null':'opaque')+' caller overrides late'+status+' after owned disposal',async()=>{
 const c=new AbortController;let readers=0,cancels=0,settled=false,caught=Symbol()
 const r=createValuticoReader({...options(()=>new Promise(resolve=>setTimeout(()=>resolve({status,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){readers++;throw Error('no body reader')},async cancel(){cancels++;await new Promise(done=>setTimeout(done,20));settled=true}}}),25))),requestTimeoutMs:10,signal:c.signal})
 const p=r.read(url);setTimeout(()=>c.abort(reason),5)
 try{await p}catch(e){caught=e}finally{try{await r.close()}catch(e){assert.equal(e,reason)}}
 assert.equal(caught,reason);assert.equal(readers,0);assert.equal(cancels,1);assert.equal(settled,true);assert.equal(r.stats().receipts[0].status,status)
})
test('request deadline owns a never-settling fetch without retry',async()=>{
 let calls=0;const r=createValuticoReader({...options(()=>{calls++;return new Promise(()=>{})}),requestTimeoutMs:5})
 try{await assert.rejects(r.read(url),e=>e.name==='TimeoutError');assert.equal(calls,1)}finally{await r.close()}
})
test('local byte ceiling cancels stream and does not mark an oversized body complete',async()=>{
 let n=0,cancels=0
 const r=createValuticoReader(options(async()=>({status:200,url,headers:new Headers({'content-type':'text/html'}),body:{getReader(){return{async read(){n++;return{done:false,value:new Uint8Array(4*1024*1024+1)}},async cancel(){cancels++},releaseLock(){}}}}})))
 try{await assert.rejects(r.read(url),/byte budget/);assert.equal(n,1);assert.equal(cancels,1);assert.equal(r.stats().receipts[0].bodyComplete,false)}finally{await r.close()}
})
test('a refused redirect is metadata-only and disposed',async()=>{
 let cancels=0
 const r=createValuticoReader(options(async()=>({status:302,url,headers:new Headers({location:'https://foreign.invalid/'}),body:{async cancel(){cancels++},getReader(){throw Error('no reader')}}})))
 try{await assert.rejects(r.read(url));assert.equal(cancels,1);assert.equal(r.stats().receipts[0].status,302)}finally{await r.close()}
})
test('source-owned exact redirect policy retains literal Location without following it',async()=>{
 let calls=0,cancels=0;const target='https://valutico.com/'
 const r=createValuticoReader(options(async()=>{calls++;return{status:301,url,headers:new Headers({location:target}),body:{async cancel(){cancels++}}}}))
 try{const row=await r.read(url,{allowRedirect:literal=>literal===target});assert.equal(row.location,target);assert.equal(row.body,null);assert.equal(calls,1);assert.equal(cancels,1)}finally{await r.close()}
})

test('source timer during pacing keeps the original TimeoutError rather than delay AbortError',async()=>{
 const original=setTimeout;let sourceDeadline,r
 globalThis.setTimeout=(fn,ms,...args)=>{if(ms===1234)sourceDeadline=fn;return original(fn,ms,...args)}
 try{
  r=createValuticoReader({fetchImpl:async()=>response(),sourceTimeoutMs:1234,requestIntervalMs:500})
  await r.read(url);assert.equal(typeof sourceDeadline,'function')
  const pending=r.read(url);sourceDeadline()
  await assert.rejects(pending,e=>e.name==='TimeoutError'&&e.message==='Valutico source deadline exceeded')
 }finally{globalThis.setTimeout=original;await r?.close()}
})
