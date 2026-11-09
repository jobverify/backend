import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,createCurrentAureconScraper} from './script.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
import {withRetry,getRetryMetadata} from '../../scraper-support/utils/retry.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {AURECON_CAREERS,AURECON_MAIN} from '../../scraper-support/myworkday/nativeAureconWorksites.js'
const sha=b=>createHash('sha256').update(b).digest('hex')
const original=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/http-denial-current-20261107.json.gz',import.meta.url))))
const response=(url,body,status=200,mime='text/html')=>{const r=new Response(body,{status,headers:{'content-type':mime}});Object.defineProperty(r,'url',{value:url});return r}
const denied=e=>e.status===406&&e.statusCode===406&&e.requestURL===AURECON_CAREERS&&e.requestUrl===AURECON_CAREERS&&e.finalURL===AURECON_CAREERS&&e.softFailure===true&&e.upstreamOutage===true&&e.failureKind==='blocked_or_access_denied'&&e.abortRetries===true
const bodyFailure=(status,cause)=>({status,url:AURECON_CAREERS,headers:new Headers({'content-type':'text/html'}),body:{cancel(){},getReader(){return{read(){throw cause},cancel(){},releaseLock(){}}}}})
globalThis.fetch=()=>{throw Error('AURECON OFFLINE NETWORK TRIPWIRE')}

test('genuine historical two-body registered source replay retains original406 body/status and exact request identity',async()=>{
 let calls=0,error
 const fetchImpl=async(url,init)=>{
  const packet=original.packets[calls++];assert.ok(packet,'no additional read after denial')
  const {receipt}=packet,bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(bytes.length,receipt.bodyBytes);assert.equal(sha(bytes),receipt.bodySHA256)
  assert.equal(url,receipt.requestedURL);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  assert.deepEqual(init.headers,{'Accept':'text/html,application/javascript','User-Agent':'JobverifyScraper/1.0'})
  assert.equal(init.credentials,undefined);assert.equal(init.body,undefined)
  return response(receipt.finalURL,bytes,receipt.status,receipt.contentType)
 }
 try{await run({fetchImpl})}catch(e){error=e}
 assert.ok(error);assert.equal(calls,2);assert.equal(error.status,406);assert.equal(error.statusCode,406)
 assert.equal(error.requestURL,AURECON_MAIN);assert.equal(error.finalURL,AURECON_MAIN)
 assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'})
 const deniedPacket=original.packets[1],body=Buffer.from(deniedPacket.bodyBase64,'base64')
 assert.equal(error.responseBody,body.toString());assert.equal(error.responseBodyBytes,98);assert.equal(error.responseBodySHA256,sha(body))
 assert.equal(error.nativeEvidence.responses.length,2);assert.equal(error.nativeEvidence.responses[1].body,body.toString())
 assert.equal(error.nativeEvidence.responses[1].sha256,sha(body));assert.equal(error.nativeEvidence.completedCompanyCollectorRecheck,false)
 assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
})

for(const status of [401,403,406,429])test('observed'+status+' is an upstream access failure with bounded genuine body and no continuation',async()=>{
 let calls=0;const text='Original '+status+' response'
 await assert.rejects(run({fetchImpl:async url=>{calls++;return response(url,text,status)}}),e=>{
  assert.equal(e.status,status);assert.equal(e.statusCode,status);assert.equal(e.requestURL,AURECON_CAREERS)
  assert.equal(e.responseBody,text);assert.equal(e.responseBodySHA256,sha(text));assert.equal(e.responseBodyBytes,Buffer.byteLength(text))
  assert.equal(e.softFailure,true);assert.equal(e.upstreamOutage,true);assert.equal(e.failureKind,'blocked_or_access_denied')
  return true
 });assert.equal(calls,1)
})

test('observed406 failed body retains numeric primary denial and exact original cause without invented bytes',async()=>{
 const cause=Error('Original response stream failed')
 await assert.rejects(run({fetchImpl:async()=>bodyFailure(406,cause)}),e=>{
  assert.ok(denied(e));assert.equal(e.cause,cause);assert.equal(e.responseBodyBytes,null);assert.equal(e.responseBodySHA256,null)
  assert.equal(e.nativeEvidence.responses[0].bodyUnavailable,true);return true
 })
})

test('observed406 opaque noncoercible body cause cannot erase the original HTTP status',async()=>{
 const cause=Object.freeze(Object.create(null))
 await assert.rejects(run({fetchImpl:async()=>bodyFailure(406,cause)}),e=>{
  assert.ok(denied(e));assert.equal(e.cause,cause);assert.equal(e.responseBodySHA256,null);return true
 })
})

for(const timeout of ['request','source'])test('observed406 stalled body keeps denial through '+timeout+' deadline and cancels once',async()=>{
 let cancels=0,releases=0
 const fetchImpl=async()=>({status:406,url:AURECON_CAREERS,headers:new Headers({'content-type':'text/html'}),body:{cancel(){},getReader(){return{read:()=>new Promise(()=>{}),cancel(){cancels++;return new Promise(()=>{})},releaseLock(){releases++}}}}})
 await assert.rejects(run({fetchImpl,requestTimeoutMs:timeout==='request'?15:1000,timeoutMs:timeout==='source'?15:1000}),e=>{
  assert.ok(denied(e));assert.equal(e.cause.failureKind,'network_or_timeout');assert.match(e.cause.message,new RegExp(timeout+' deadline'))
  assert.equal(e.responseBodyBytes,null);return true
 });assert.equal(cancels,1);assert.equal(releases,1)
})

for(const reason of [Object.freeze(Object.create(null)),Symbol('caller'),null])test('exact caller reason wins over observed406 body without reason coercion: '+typeof reason,async()=>{
 const caller=new AbortController();let began;const ready=new Promise(r=>began=r)
 const fetchImpl=async()=>({status:406,url:AURECON_CAREERS,headers:new Headers({'content-type':'text/html'}),body:{cancel(){},getReader(){return{read(){began();return new Promise(()=>{})},cancel(){return new Promise(()=>{})},releaseLock(){}}}}})
 const pending=run({fetchImpl,signal:caller.signal});pending.catch(()=>{});await Promise.race([ready,pending.then(()=>assert.fail('denial returned jobs'),()=>assert.fail('406 rejected before bounded body collection'))]);caller.abort(reason);await assert.rejects(pending,e=>e===reason)
})

test('actual200 malformed publisher remains a hard parser failure without false HTTP406 or empty inventory',async()=>{
 let calls=0;await assert.rejects(run({fetchImpl:async url=>{calls++;return response(url,'<html><body>unrecognized current publisher</body></html>')}}),e=>{
  assert.equal(e.failureKind,'parser_or_contract_error');assert.equal(e.status,undefined)
  assert.deepEqual(classifyScraperError(e),{softFailure:false,upstreamOutage:false,failureKind:'parser_or_contract_error'});return true
 });assert.equal(calls,1)
})

test('observed406 body cap retains primary denial and original cap cause without fabricated completed body',async()=>{
 await assert.rejects(run({fetchImpl:async()=>({status:406,url:AURECON_CAREERS,headers:new Headers({'content-type':'text/html','content-length':'4194305'}),body:{cancel(){},getReader(){throw Error('must not read overcap')}}})}),e=>{
  assert.ok(denied(e));assert.match(e.cause.message,/byte bound/);assert.equal(e.responseBodySHA256,null);return true
 })
})

test('invalid UTF8 denial retains original complete raw bytes/hash and numeric status',async()=>{
 const bytes=Buffer.from([0x80,0xff]);await assert.rejects(run({fetchImpl:async url=>response(url,bytes,406)}),e=>{
  assert.ok(denied(e));assert.ok(e.cause instanceof TypeError);assert.equal(e.responseBodyBytes,2);assert.equal(e.responseBodySHA256,sha(bytes))
  assert.equal(e.nativeEvidence.responses[0].originalBodyBase64,bytes.toString('base64'));return true
 })
})

test('prelaunch opaque caller abort prevents every read',async()=>{
 const caller=new AbortController(),reason=Object.freeze(Object.create(null));let calls=0
 const pending=run({signal:caller.signal,fetchImpl:async()=>{calls++;throw Error('must not fetch')}});caller.abort(reason)
 await assert.rejects(pending,e=>e===reason);assert.equal(calls,0)
})

test('200 response identity remains strict and does not become an upstream access failure',async()=>{
 await assert.rejects(createCurrentAureconScraper().run({fetchImpl:async()=>response('https://unrelated.invalid/',original.packets[0].bodyBase64)}),e=>{
  assert.equal(e.failureKind,'parser_or_contract_error');assert.match(e.message,/response URL identity/);assert.equal(e.status,undefined);return true
 })
})

test('current registered provider and unchanged four-attempt retry classify observed406 as upstream denial after one invocation',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='aurecon');assert.ok(provider)
 let calls=0
 await assert.rejects(withRetry(()=>createCatalogScraper(provider).run({fetchImpl:async url=>{calls++;return response(url,'Original public denial',406)}}),{attempts:4,baseDelayMs:0,label:'aurecon-offline-control'}),e=>{
  assert.match(e.message,/Retry aborted after attempt 1\/4/)
  assert.deepEqual(classifyScraperError(e),{softFailure:true,upstreamOutage:true,failureKind:'blocked_or_access_denied'})
  assert.equal(e.cause.status,406);assert.equal(e.cause.requestURL,AURECON_CAREERS)
  assert.equal(e.cause.responseBody,'Original public denial');assert.equal(getRetryMetadata(e).attemptsUsed,1);return true
 });assert.equal(calls,1)
})

test('synchronously throwing reader cancellation cannot replace original406 body error or its exact cause',async()=>{
 const cause=Error('Original denied response body failed'),cleanup=Error('Reader cancellation failed')
 let cancels=0,releases=0
 const fetchImpl=async()=>({status:406,url:AURECON_CAREERS,headers:new Headers({'content-type':'text/html'}),body:{cancel(){throw Error('locked body must use reader cleanup')},getReader(){return{read(){throw cause},cancel(){cancels++;throw cleanup},releaseLock(){releases++}}}}})
 await assert.rejects(run({fetchImpl}),e=>{assert.ok(denied(e));assert.equal(e.cause,cause);assert.equal(e.responseBodySHA256,null);return true})
 assert.equal(cancels,1);assert.equal(releases,1)
})

test('synchronously throwing unconsumed body cancellation cannot replace known406 byte-cap error',async()=>{
 const cleanup=Error('Unconsumed response cancellation failed');let cancels=0
 const fetchImpl=async()=>({status:406,url:AURECON_CAREERS,headers:new Headers({'content-type':'text/html','content-length':'4194305'}),body:{getReader(){throw Error('over-cap body must remain unconsumed')},cancel(){cancels++;throw cleanup}}})
 await assert.rejects(run({fetchImpl}),e=>{assert.ok(denied(e));assert.notEqual(e.cause,cleanup);assert.match(e.cause.message,/byte bound/);assert.equal(e.responseBodySHA256,null);return true})
 assert.equal(cancels,1)
})
