import assert from 'node:assert/strict'
import test from 'node:test'
import {fetchJsonWithRetry,fetchTextWithRetry,isHttpAccessChallenge} from '../utils/fetch.js'
import {classifyScraperError} from '../runner.js'
import {requireNativeHttpResponse} from '../shared/nativeHttpResponse.js'

test('AWS WAF challenge metadata is terminal even when observed HTTP202 is successful transport',async t=>{
 for(const reader of [fetchTextWithRetry,fetchJsonWithRetry])await t.test(reader.name,async()=>{
  let calls=0,cancels=0
  const fetchImpl=async()=>{
   calls++
   return new Response(new ReadableStream({cancel(){cancels++}}),{status:202,headers:{'x-amzn-waf-action':'challenge','content-type':'text/html'}})
  }
  await assert.rejects(reader('https://example.com/careers',{fetchImpl,attempts:3,baseDelayMs:0,timeoutMs:500}),error=>{
   assert.equal(error.status,202)
   assert.equal(error.accessChallenge,true)
   assert.equal(error.abortRetries,true)
   assert.equal(classifyScraperError(error).failureKind,'blocked_or_access_denied')
   return true
  })
  assert.equal(calls,1)
  assert.equal(cancels,1)
 })
})

test('AWS access marker is exact and case-normalized without rejecting ordinary accepted responses',()=>{
 const response=(status,value)=>new Response('',{status,headers:value==null?{}:{'x-amzn-waf-action':value}})
 assert.equal(isHttpAccessChallenge(response(202,' ChAlLeNgE ')),true)
 for(const value of [null,'allow','challenge-passed','unchallenged'])assert.equal(isHttpAccessChallenge(response(202,value)),false)
})

test('ordinary HTTP202 JSON without a challenge header remains readable',async()=>{
 const value=await fetchJsonWithRetry('https://example.com/accepted',{attempts:1,
  fetchImpl:async()=>Response.json({accepted:true},{status:202})})
 assert.deepEqual(value,{accepted:true})
})

test('native HTTP boundary retains AWS challenge status without overriding unrelated URL identity',async()=>{
 const requested='https://example.com/careers'
 for(const status of [200,202]){
  const response=Object.defineProperty(new Response('challenge',{status,headers:{'x-amzn-waf-action':'challenge'}}),'url',{value:requested})
  await assert.rejects(requireNativeHttpResponse(response,requested),error=>{
   assert.equal(error.status,status)
   assert.equal(error.accessChallenge,true)
   assert.equal(error.failureKind,'blocked_or_access_denied')
   assert.equal(error.softFailure,true)
   assert.equal(error.lifecycleCleanupAllowed,false)
   return true
  })
 }
 const unrelated=Object.defineProperty(new Response('challenge',{status:202,headers:{'x-amzn-waf-action':'challenge'}}),'url',{value:'https://other.example/careers'})
 await assert.rejects(requireNativeHttpResponse(unrelated,requested),error=>error.failureKind==='parser_or_contract_error'&&error.softFailure===false)
})

test('native HTTP202 without a challenge remains a pending upstream response',async()=>{
 const url='https://example.com/pending',response=Object.defineProperty(new Response('',{status:202}),'url',{value:url})
 await assert.rejects(requireNativeHttpResponse(response,url),error=>error.status===202&&error.failureKind==='upstream_response_pending'&&!error.accessChallenge)
})
