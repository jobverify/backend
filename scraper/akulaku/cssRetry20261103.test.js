import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
import {reducedBoard} from './test-data/reducedNativeHarness.js'
import {NATIVE_STYLESHEETS} from './criteriaVisibility.js'

globalThis.fetch=()=>{throw Error('Offline Akulaku CSS retry network tripwire')}
const timeout=label=>Object.assign(new TypeError(label),{cause:Object.assign(Error('connection did not complete'),{code:'UND_ERR_CONNECT_TIMEOUT'})})
const seam=behavior=>{const fixture=reducedBoard(),calls=[];let cssAttempts=0;return{calls,fixture,get cssAttempts(){return cssAttempts},fetchImpl:async(url,request)=>{calls.push({url,request});if(url===NATIVE_STYLESHEETS[0]){cssAttempts++;await behavior?.(cssAttempts,request)}const packet=structuredClone(fixture.pages.get(url));assert.ok(packet,'only declared original public URL');return packet}}}

test('Akulaku retries a pre-header declared CSS connect timeout once with the identical bounded GET',async()=>{
 const stop=timeout('audit observer original reason'),fixture=seam(attempt=>{if(attempt===1)throw timeout('first connection timeout')});let receipt
 await assert.rejects(run({fetchImpl:fixture.fetchImpl,onResponse:value=>{if(value.url===NATIVE_STYLESHEETS[0]){receipt=value;throw stop}}}),error=>error===stop)
 assert.equal(fixture.cssAttempts,2);assert.equal(receipt.networkAttempts,2);assert.equal(receipt.transientConnectTimeoutRetried,true)
 const attempts=fixture.calls.filter(row=>row.url===NATIVE_STYLESHEETS[0]);assert.equal(attempts[0].request.method,'GET');assert.equal(attempts[0].request.signal,attempts[1].request.signal);assert.deepEqual(attempts[0].request.headers,attempts[1].request.headers)
})

test('Akulaku a second CSS connect timeout propagates without a third attempt',async()=>{
 const first=timeout('first'),second=timeout('second'),fixture=seam(attempt=>{throw attempt===1?first:second})
 await assert.rejects(run({fetchImpl:fixture.fetchImpl}),error=>error===second);assert.equal(fixture.cssAttempts,2)
})

test('Akulaku CSS HTTP denial and certificate failure never retry',async()=>{
 const denied=seam(),original=denied.fetchImpl
 await assert.rejects(run({fetchImpl:async(url,request)=>url===NATIVE_STYLESHEETS[0]?(denied.calls.push({url,request}),{url,status:403,html:'Denied'}):original(url,request)}),error=>error.status===403&&error.abortRetries)
 assert.equal(denied.calls.filter(row=>row.url===NATIVE_STYLESHEETS[0]).length,1)
 const reason=Object.assign(new TypeError('strict TLS chain failed'),{cause:{code:'UNABLE_TO_VERIFY_LEAF_SIGNATURE'}}),tls=seam(()=>{throw reason})
 await assert.rejects(run({fetchImpl:tls.fetchImpl}),error=>error===reason);assert.equal(tls.cssAttempts,1)
})

test('Akulaku caller abort during the CSS retry delay preserves its exact reason and starts no second request',async()=>{
 const caller=new AbortController(),reason=Object.freeze({caller:'during-css-retry'}),fixture=seam(()=>{setTimeout(()=>caller.abort(reason),5);throw timeout('first')})
 await assert.rejects(run({signal:caller.signal,fetchImpl:fixture.fetchImpl}),error=>error===reason);assert.equal(fixture.cssAttempts,1)
})

test('Akulaku owned collection deadline bounds the CSS retry delay rather than creating a new deadline',async()=>{
 const budget=4000,started=Date.now(),fixture=seam(async()=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,budget-(Date.now()-started)-30)));throw timeout('first near original deadline')})
 await assert.rejects(run({collectionBudgetMs:budget,fetchImpl:fixture.fetchImpl}),error=>error.code==='AKULAKU_COLLECTION_TIMEOUT');assert.equal(fixture.cssAttempts,1)
})
