import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz',import.meta.url))))
const about=fixture.packets[0]
const originalAbout=()=>Object.defineProperty(new Response(Buffer.from(about.bodyBase64,'base64'),{status:about.status,headers:about.headers}),
 'url',{value:about.url})

for(const status of [429,202])test('Springworks redirect HTTP'+status+' remains the observed denial instead of a redirect parser failure',async()=>{
 let reads=0
 await assert.rejects(run({fetchImpl:async url=>{
  if(++reads===1)return originalAbout()
  return Object.defineProperty(new Response('',{status,headers:{'content-type':'text/html',...(status===202?{'x-amzn-waf-action':'challenge'}:{})}}),
   'url',{value:String(url)})
 }}),error=>{
  assert.equal(error.httpStatus,status);assert.equal(error.failureKind,'blocked_or_access_denied')
  assert.equal(error.recruitmentObservations.retainedResponses.at(-1).status,status)
  return true
 })
 assert.equal(reads,2)
})

test('Springworks observed403 wins over stalled body/read/cancel and a shorter local read deadline',async()=>{
 let reads=0,canceled=0
 const started=Date.now()
 await assert.rejects(run({requestTimeoutMs:20,fetchImpl:async url=>{
  reads++
  return Object.defineProperty(new Response(new ReadableStream({cancel(){canceled++;return new Promise(()=>{})}}),
   {status:403,headers:{'content-type':'text/html'}}),'url',{value:String(url)})
 }}),error=>{
  assert.equal(error.httpStatus,403);assert.equal(error.failureKind,'blocked_or_access_denied')
  const receipt=error.recruitmentObservations.retainedResponses.at(-1)
  assert.equal(receipt.status,403);assert.equal(receipt.bodyComplete,false)
  return true
 })
 assert.equal(reads,1);assert.equal(canceled,1)
 assert.ok(Date.now()-started<500,'Known HTTP denial must not await a hanging body/cancellation')
})

test('Springworks denied foreign response retains hard identity failure and caller cancellation still wins',async()=>{
 await assert.rejects(run({fetchImpl:async()=>Object.defineProperty(new Response('',{status:403}),
  'url',{value:'https://foreign.example/'})}),error=>error.httpStatus===403&&error.failureKind==='parser_or_contract_error'&&error.softFailure===false)
 const controller=new AbortController(),reason=Object.freeze({owner:'caller-priority'})
 await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{
  queueMicrotask(()=>controller.abort(reason))
  return Object.defineProperty(new Response('',{status:403}),'url',{value:String(url)})
 }}),error=>error===reason)
})
