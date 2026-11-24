import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runCurrentRxLogix} from './currentNative20261115.js'

globalThis.fetch=async()=>{throw Error('Physical network forbidden in source regression')}
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-originals-20261120.json.gz',import.meta.url))))
const original=fixture.packets[0]

for(const [name,change,status,kind] of [
 ['HTTP403',p=>{p.status=403},403,'blocked_or_access_denied'],
 ['HTTP429',p=>{p.status=429;p.headers['retry-after']='120'},429,'blocked_or_access_denied'],
 ['manual redirect',p=>{p.status=302;p.headers.location='https://other.example/'},302,'surface_drift_or_fail_closed'],
 ['foreign finalURL',p=>{p.url='https://other.example/careers/'},200,'coverage_gap'],
 ['malformed MIME',p=>{p.headers['content-type']='text/htmlx; charset=UTF-8'},200,'coverage_gap'],
 ['declared charset',p=>{p.headers['content-type']='text/html; charset=iso-8859-1'},200,'coverage_gap'],
 ['navigation header',p=>{p.headers.refresh='0;url=https://other.example/'},200,'coverage_gap'],
 ['Cloudflare challenge200',p=>{p.headers['cf-mitigated']='challenge'},200,'blocked_or_access_denied'],
 ['AWS challenge202',p=>{p.status=202;p.headers['x-amzn-waf-action']='challenge'},202,'blocked_or_access_denied'],
]){
 test(name+' is rejected with original metadata before any body reader',async()=>{
  const p=structuredClone(original);change(p)
  const stats={calls:0,readers:0,reads:0,cancels:0}
  const body={getReader(){stats.readers++;return{read(){stats.reads++;return Promise.resolve({done:true})},cancel(){stats.cancels++},releaseLock(){}}},cancel(){stats.cancels++;return Promise.resolve()}}
  let failure
  try{await runCurrentRxLogix({requestIntervalMs:0,fetchImpl:async()=>{stats.calls++;return{status:p.status,url:p.url,headers:new Headers(p.headers),body}}})}catch(error){failure=error}
  assert.ok(failure,'must hold unqualified response')
  assert.equal(stats.readers,0,'rejected response opened a body reader')
  assert.equal(stats.reads,0,'rejected response consumed body bytes')
  assert.equal(stats.calls,1)
  assert.equal(stats.cancels,1)
  assert.equal(failure.failureKind,kind)
  assert.equal(failure.lifecycleCleanupAllowed,false)
  const receipt=failure.sourceAudit.originalResponses[0]
  assert.equal(receipt.status,status)
  assert.equal(receipt.url,p.url)
  assert.equal(receipt.bodyRead,false)
  assert.equal(receipt.acquisitionComplete,false)
  assert.equal(Object.hasOwn(receipt,'bodyBase64'),false)
 })
}

test('known429 remains primary when body cancellation never settles',async()=>{
 let readers=0,cancels=0
 await assert.rejects(runCurrentRxLogix({sourceDeadlineMs:30,requestIntervalMs:0,fetchImpl:async()=>({
  status:429,url:original.url,headers:new Headers(original.headers),
  body:{getReader(){readers++;throw Error('must not open')},cancel(){cancels++;return new Promise(()=>{})}}
 })}),error=>error.status===429&&error.failureKind==='blocked_or_access_denied')
 assert.equal(readers,0);assert.equal(cancels,1)
})

test('opaque caller cancellation triggered by rejected-entity disposal wins exactly',async()=>{
 const owner=new AbortController(),reason=Object.freeze({caller:'dispose-stop'});let readers=0
 await assert.rejects(runCurrentRxLogix({signal:owner.signal,requestIntervalMs:0,fetchImpl:async()=>({
  status:403,url:original.url,headers:new Headers(original.headers),
  body:{getReader(){readers++;throw Error('must not open')},cancel(){owner.abort(reason)}}
 })}),error=>error===reason)
 assert.equal(readers,0)
})
