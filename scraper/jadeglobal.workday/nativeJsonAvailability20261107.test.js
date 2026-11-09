import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createJadeJsonAvailabilityReader} from './nativeJsonAvailability.js'
import {fetchJsonWithRetry} from '../../scraper-support/utils/fetch.js'
import {hasWorkdayOutageSignal} from '../../scraper-support/myworkday/engine.js'
import {run, createJadeGlobalScraper, JOBS_API_URL, CAREERS_URL} from './script.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
const fixture=JSON.parse(fs.readFileSync(new URL('./maintenance-response-20261107.fixture.json',import.meta.url)))
const packets=fixture.packets
const sha=b=>createHash('sha256').update(b).digest('hex')
const rejection=async operation=>{let rejected=false,error;try{await operation()}catch(e){rejected=true;error=e}assert.equal(rejected,true);return error}
const response=p=>{const body=Buffer.from(p.bodyBase64,'base64');assert.equal(sha(body),p.bodySHA256);assert.equal(body.length,p.bodyBytes);const r=new Response(body,{status:p.status,headers:{'content-type':p.mime}});Object.defineProperty(r,'url',{value:p.finalURL});return r}
const originalFetch=globalThis.fetch
globalThis.fetch=()=>{throw Error('Network forbidden in Jade regression tests')}
const withFetch=async(fn,operation)=>{const previous=globalThis.fetch;globalThis.fetch=fn;try{return await operation()}finally{globalThis.fetch=previous}}

test('registered Jade default preserves exact genuine two-packet request intent and classifies maintenance as unavailable',async()=>{
 const registered=JSON.parse(fs.readFileSync(new URL('../../scraper-support/providers/customProviders.json',import.meta.url))).find(p=>p.source==='jadeglobal')
 assert.equal(registered.modulePath,'../jadeglobal.workday/script.js')
 let count=0
 const error=await withFetch(async(url,init={})=>{const p=packets[count++];assert.ok(p,'Unexpected fetch invocation');assert.equal(String(url),p.request.url);assert.equal(init.method??'GET',p.request.method);assert.deepEqual(init.headers,p.request.headers);assert.equal(init.body??null,p.request.body);assert.equal(init.redirect??'follow(default)',p.request.redirect);return response(p)},()=>rejection(()=>run()))
 assert.equal(count,2)
 assert.equal(classifyScraperError(error).softFailure,true)
 assert.equal(classifyScraperError(error).upstreamOutage,true)
 assert.equal(error.failureKind,'upstream_unavailable')
 assert.equal(error.status,200)
 assert.equal(error.nativeResponseEvidence.bodySHA256,packets[1].bodySHA256)
 assert.equal(error.cause.failureKind,'parser_or_contract_error')
})
for(const reason of [Symbol('caller'),Object.freeze({opaque:'caller'}),null])test('registered pre-aborted caller remains exact before any reads '+typeof reason,async()=>{
 const controller=new AbortController();controller.abort(reason);let calls=0
 const error=await withFetch(async()=>{calls++;throw Error('Unexpected request')},()=>rejection(()=>run({signal:controller.signal})))
 assert.equal(error,reason);assert.equal(calls,0)
})
test('factory injected callback abort wins before native continuation',async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:'during-careers'});let jsonReads=0
 const error=await rejection(()=>createJadeGlobalScraper().run({signal:controller.signal,fetchText:async()=>{controller.abort(reason);return Buffer.from(packets[0].bodyBase64,'base64').toString()},fetchJson:async()=>{jsonReads++;return {jobPostings:[],total:0}}}))
 assert.equal(error,reason);assert.equal(jsonReads,0)
})


// Controls use genuine bytes or explicitly synthetic mutations; none acquire data.
{
 const packet=packets[1],body=Buffer.from(packet.bodyBase64,'base64'),url=packet.request.url,finalURL=packet.finalURL
 const options={method:packet.request.method,headers:packet.request.headers,body:packet.request.body,attempts:1,timeoutMs:1000}
 const response=(bytes=body,{status=200,mime='text/html',final=finalURL}={})=>{const r=new Response(bytes,{status,headers:{'content-type':mime}});Object.defineProperty(r,'url',{value:final});return r}
 const reader=fetchImpl=>createJadeJsonAvailabilityReader({fetchJsonWithRetry,fetchImpl})
test('genuine exact CXS maintenance response is availability, with original parser cause and observed HTTP200',async()=>{
  const e=await rejection(()=>reader(async()=>response())(url,options))
  assert.equal(classifyScraperError(e).softFailure,true)
  assert.equal(classifyScraperError(e).upstreamOutage,true)
  assert.equal(e.failureKind,'upstream_unavailable')
  assert.equal(e.status,200)
  assert.equal(e.nativeResponseEvidence.bodySHA256,packet.bodySHA256)
  assert.equal(e.cause.failureKind,'parser_or_contract_error')
})
test('same genuine publisher body is recognized by existing Workday outage detector',()=>assert.equal(hasWorkdayOutageSignal({html:body.toString(),url:finalURL}),true))
for(const [name,bytes,meta,request]of [
 ['generic HTML',Buffer.from('<html><title>Careers</title><p>Workday is currently unavailable.</p></html>'),{final:url}],
 ['foreign final authority',body,{final:'https://foreign.example/maintenance-page.html'}],
 ['changed maintenance body',Buffer.concat([body,Buffer.from('<!--unreviewed drift-->')]),{}],
 ['unknown maintenance query',body,{final:finalURL+'?unknown=1'}],
 ['wrong request endpoint',body,{},'https://foreign.example/jobs'],
 ['wrong MIME',body,{mime:'application/json'}],
 ['invalid JSON',Buffer.from('{"jobPostings":['),{mime:'application/json',final:url}],
 ])test(name+' remains original hard parser failure',async()=>{const e=await rejection(()=>reader(async()=>response(bytes,meta))(request??url,options));assert.equal(classifyScraperError(e).failureKind,'parser_or_contract_error');assert.equal(classifyScraperError(e).softFailure,false);assert.equal(e.nativeResponseEvidence,undefined)})
test('wrong request method is not admitted as source maintenance',async()=>{const e=await rejection(()=>reader(async()=>response())(url,{...options,method:'GET'}));assert.equal(e.failureKind,'parser_or_contract_error');assert.equal(e.nativeResponseEvidence,undefined)})
test('valid JSON with outage words retains exact payload, without classification',async()=>{const payload={jobPostings:[],total:0,note:'Workday is currently unavailable.'};assert.deepEqual(await reader(async()=>response(JSON.stringify(payload),{mime:'application/json',final:url}))(url,options),payload)})
test('invalid response shape is not converted by the transport',async()=>{const payload=await reader(async()=>response('{"unexpected":"Workday is currently unavailable."}',{mime:'application/json',final:url}))(url,options);assert.deepEqual(payload,{unexpected:'Workday is currently unavailable.'});assert.equal(Array.isArray(payload.jobPostings),false)})
for(const status of [401,403,406,429,503])test('HTTP'+status+' retains original status/cause classification',async()=>{const e=await rejection(()=>reader(async()=>response(body,{status}))(url,options));let cause=e;while(cause.cause)cause=cause.cause;assert.equal(cause.status,status);assert.equal(e.nativeResponseEvidence,undefined);assert.equal(classifyScraperError(e).failureKind,status===503?'network_or_timeout':'blocked_or_access_denied')})
test('foreign typed parser error is preserved through existing retry cause',async()=>{const foreign=Object.assign(new Error('Foreign failure: Workday is currently unavailable.'),{failureKind:'parser_or_contract_error',abortRetries:true});const e=await rejection(()=>reader(async()=>{throw foreign})(url,options));assert.equal(e.cause,foreign);assert.equal(e.nativeResponseEvidence,undefined);assert.equal(classifyScraperError(e).softFailure,false)})
for(const reason of [Symbol('caller'),Object.freeze({opaque:'caller'}),null])test('opaque caller reason wins exactly without request '+String(typeof reason),async()=>{const c=new AbortController();c.abort(reason);let calls=0;let caught;try{await reader(async()=>{calls++;return response()})(url,{...options,signal:c.signal})}catch(e){caught=e}assert.equal(caught,reason);assert.equal(calls,0)})

}

for(const [name,body] of [['malformed JSON','{"jobPostings":['],['unrecognized JSON shape','{"unexpected":"Workday is currently unavailable."}']])test('registered '+name+' retains existing source validation',async()=>{
 let count=0
 const error=await withFetch(async()=>++count===1?response(packets[0]):new Response(body,{headers:{'content-type':'application/json'}}),()=>rejection(()=>run()))
 assert.equal(count,2)
 assert.equal(error.nativeResponseEvidence,undefined)
 if(name==='malformed JSON'){assert.equal(classifyScraperError(error).failureKind,'parser_or_contract_error');assert.equal(classifyScraperError(error).softFailure,false)}
 else assert.match(error.message,/no longer matches the expected Workday payload/)
})
test('injected JSON callback failure remains its exact original object',async()=>{
 const foreign=Object.freeze({failure:'injected callback'}),career=Buffer.from(packets[0].bodyBase64,'base64').toString()
 const error=await rejection(()=>run({fetchText:async()=>career,fetchJson:async()=>{throw foreign}}))
 assert.equal(error,foreign)
})
test('caller abort during injected JSON failure wins without inspecting foreign error',async()=>{
 const controller=new AbortController(),reason=Symbol('caller-json'),foreign={get message(){throw Error('Forbidden inspection')}},career=Buffer.from(packets[0].bodyBase64,'base64').toString()
 const error=await rejection(()=>run({signal:controller.signal,fetchText:async()=>career,fetchJson:async()=>{controller.abort(reason);throw foreign}}))
 assert.equal(error,reason)
})
test('caller abort after observing exact maintenance cannot be converted to availability',async()=>{
 const controller=new AbortController(),reason=Object.freeze({abort:'after-observation'}),foreign=Object.freeze({failure:'injected shared callback'})
 const read=createJadeJsonAvailabilityReader({fetchImpl:async()=>response(packets[1]),fetchJsonWithRetry:async(url,options)=>{await options.fetchImpl(url,{...options,signal:controller.signal});controller.abort(reason);throw foreign}})
 const p=packets[1],error=await rejection(()=>read(p.request.url,{...p.request,signal:controller.signal}))
 assert.equal(error,reason)
})
test('pending headers abort preserves reason and disposes late response without more requests',async()=>{
 const controller=new AbortController(),reason=Symbol('pending-headers');let finish,calls=0,cancels=0
 const read=createJadeJsonAvailabilityReader({fetchJsonWithRetry,fetchImpl:()=>{calls++;return new Promise(resolve=>{finish=resolve})}}),p=packets[1]
 const operation=read(p.request.url,{...p.request,attempts:1,signal:controller.signal})
 while(!finish)await new Promise(resolve=>setImmediate(resolve))
 controller.abort(reason)
 assert.equal(await rejection(()=>operation),reason)
 finish({body:{cancel(){cancels++;throw Error('Cleanup must not replace reason')}}})
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(cancels,1)
})
test('detail fallback cannot swallow caller abort',async()=>{
 const controller=new AbortController(),reason=Object.freeze({abort:'detail'}),career=Buffer.from(packets[0].bodyBase64,'base64').toString();let calls=0
 const error=await rejection(()=>run({signal:controller.signal,fetchText:async()=>{if(++calls===1)return career;controller.abort(reason);throw Error('Different detail error')},fetchJson:async()=>({total:1,jobPostings:[{title:'Synthetic control',locationsText:'India',externalPath:'/job/India/Control_R-1',bulletFields:['R-1']}]})}))
 assert.equal(error,reason);assert.equal(calls,2)
})

for(const [name,patch] of [
 ['other limit',{body:JSON.stringify({appliedFacets:{},limit:19,offset:0,searchText:''})}],
 ['later page',{body:JSON.stringify({appliedFacets:{},limit:20,offset:20,searchText:''})}],
 ['changed facet',{body:JSON.stringify({appliedFacets:{country:['India']},limit:20,offset:0,searchText:''})}],
 ['search query',{body:JSON.stringify({appliedFacets:{},limit:20,offset:0,searchText:'India'})}],
 ['GET',{method:'GET'}],
])test('unobserved request intent '+name+' remains original parser error',async()=>{
 const p=packets[1],read=createJadeJsonAvailabilityReader({fetchJsonWithRetry,fetchImpl:async()=>response(p)})
 const error=await rejection(()=>read(p.request.url,{...p.request,...patch,attempts:1}))
 assert.equal(error.failureKind,'parser_or_contract_error');assert.equal(error.nativeResponseEvidence,undefined)
})
for(const reason of [Symbol('body-abort'),Object.freeze({abort:'body'})])test('pending maintenance clone body preserves caller '+typeof reason,async()=>{
 const controller=new AbortController();let entered
 const ready=new Promise(resolve=>{entered=resolve}),p=packets[1]
 const r=new Response(new ReadableStream({start(){entered()},cancel(){}}),{headers:{'content-type':'text/html'}})
 Object.defineProperty(r,'url',{value:p.finalURL})
 const read=createJadeJsonAvailabilityReader({fetchJsonWithRetry,fetchImpl:async()=>r})
 const operation=read(p.request.url,{...p.request,attempts:1,signal:controller.signal})
 await ready;await new Promise(resolve=>setImmediate(resolve));controller.abort(reason)
 assert.equal(await rejection(()=>operation),reason)
})
test('pending maintenance body obeys unchanged per-read deadline without false availability',async()=>{
 const p=packets[1];let calls=0
 const r=new Response(new ReadableStream({cancel(){}}),{headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:p.finalURL})
 const read=createJadeJsonAvailabilityReader({fetchJsonWithRetry,fetchImpl:async()=>{calls++;return r}})
 // AbortSignal.timeout uses an unref timer; keep only this offline deadline check alive.
 const keepAlive=setTimeout(()=>{},1000)
 try{const error=await rejection(()=>read(p.request.url,{...p.request,attempts:1,timeoutMs:20}));assert.equal(error.nativeResponseEvidence,undefined);assert.equal(calls,1);assert.match(error.message,/timeout|timed out/i)}finally{clearTimeout(keepAlive)}
})
test('concurrent invocation cannot borrow another response maintenance evidence',async()=>{
 const p=packets[1],read=createJadeJsonAvailabilityReader({fetchJsonWithRetry,fetchImpl:async(url,init)=>init.body===p.request.body?response(p):new Response('<html>Unreviewed</html>',{headers:{'content-type':'text/html'}})})
 const errors=await Promise.all([rejection(()=>read(p.request.url,{...p.request,attempts:1})),rejection(()=>read(p.request.url,{...p.request,body:'{}',attempts:1}))])
 assert.equal(errors[0].failureKind,'upstream_unavailable');assert.equal(errors[1].failureKind,'parser_or_contract_error');assert.equal(errors[1].nativeResponseEvidence,undefined)
})
