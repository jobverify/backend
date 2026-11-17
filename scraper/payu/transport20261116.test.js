import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {fetchReviewedPayUPage} from './currentNative20261116.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/handoff-20261116.json.gz',import.meta.url))))
const corporate='https://corporate.payu.in/careers/',board='https://careers.payu.in/PayU/go/_/514880/'
const originalResponse=(p,headers=p.headers)=>{const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers});Object.defineProperty(r,'url',{value:p.url});return r}
async function withFetch(mock,work){const original=globalThis.fetch;globalThis.fetch=mock;try{return await work()}finally{globalThis.fetch=original}}
test('PayU reads the two actual first-party 301 handoffs manually without submitting applications',async()=>{
 const calls=[];const page=await withFetch(async(url,init)=>{calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');return originalResponse(capture.packets.find(p=>p.requestedURL===url))},()=>fetchReviewedPayUPage(corporate))
 assert.deepEqual(calls,capture.packets.map(p=>p.requestedURL));assert.equal(page.url,board);assert.ok(page.html.includes('PayU'))
})
test('PayU rejects a changed corporate redirect before contacting it',async()=>{
 const calls=[];await withFetch(async url=>{calls.push(url);return originalResponse(capture.packets[0],{location:'https://other.example/careers'})},()=>assert.rejects(fetchReviewedPayUPage(corporate),/Changed first-party redirect destination/));assert.deepEqual(calls,[corporate])
})
test('PayU rejects a native continuation redirect and never follows it',async()=>{
 const calls=[];await withFetch(async url=>{calls.push(url);const r=new Response(null,{status:301,headers:{location:'https://other.example/jobs'}});Object.defineProperty(r,'url',{value:url});return r},()=>assert.rejects(fetchReviewedPayUPage(board),/Changed first-party redirect destination/));assert.deepEqual(calls,[board])
})
test('PayU aborts a pending transport and preserves opaque caller cancellation',async()=>{
 const controller=new AbortController(),reason={cancel:'source-owned-cancellation'}
 await withFetch(()=>new Promise(()=>{}),async()=>{const pending=fetchReviewedPayUPage(board,{signal:controller.signal});controller.abort(reason);await assert.rejects(pending,error=>error===reason)})
})
test('PayU cancels an original native entity stream which exceeds its byte cap',async()=>{
 let cancelled=false
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(2000001))},cancel(){cancelled=true}}),response=new Response(body,{headers:{'content-type':'text/html; charset=utf-8'}});Object.defineProperty(response,'url',{value:board})
 await withFetch(async()=>response,()=>assert.rejects(fetchReviewedPayUPage(board),/Original native body cap/));assert.equal(cancelled,true)
})
test('PayU disposes a response which followed an unvalidated redirect before rejecting it',async()=>{
 let cancelled=false
 const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://other.example/jobs'})
 await withFetch(async()=>response,()=>assert.rejects(fetchReviewedPayUPage(board),/Unvalidated followed response/));assert.equal(cancelled,true)
})
