import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'

globalThis.fetch=async()=>{throw Error('Physical network forbidden in current source regression')}
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-prefix-20261120.json.gz',import.meta.url))))
const groups=new Map()
for(const p of historical.packets){const url=p.requestedURL??p.url;if(!groups.has(url))groups.set(url,[]);groups.get(url).push(p)}
const original=new Map(historical.originalRegisteredPackets.map(p=>[p.requestedURL,p]))
const currentMap=new Map(current.packets.map(p=>[p.requestedURL,p]))
function transport({prefix=true,mutate}={}){
 const visits=new Map(),calls=[]
 return{calls,fetchImpl:async(value,init)=>{
  const url=String(value),index=visits.get(url)??0;visits.set(url,index+1)
  const historicalPacket=groups.get(url)?.[Math.min(index,(groups.get(url)?.length??1)-1)]??original.get(url)
  assert.ok(historicalPacket,'Only genuine reviewed URLs available')
  const p=structuredClone(prefix&&index===0&&currentMap.has(url)?currentMap.get(url):historicalPacket)
  p.kind=historicalPacket.kind;p.url??=p.finalUrl
  p.body=Buffer.from(p.bodyBase64,'base64').toString('utf8')
  if(mutate)mutate(p,url,index)
  calls.push({url,method:init.method})
  const response=new Response(p.body,{status:p.status,headers:p.headers})
  Object.defineProperty(response,'url',{value:p.url??p.finalUrl});return response
 }}
}
const fixed={requestIntervalMs:0,now:()=>new Date('2026-11-15T17:30:00.000Z')}

test('actual seven-response corporate prefix tolerates passive reporting drift with historical-only native continuation',async()=>{
 const t=transport(),jobs=await run({...fixed,fetchImpl:t.fetchImpl})
 assert.deepEqual(t.calls.slice(0,7).map(r=>r.url),current.packets.map(p=>p.requestedURL))
 assert.equal(jobs.length,2);assert.equal(jobs.sourceAudit.opening.rows.length,48)
 assert.equal(jobs.sourceAudit.independentNativeClosingReconciled,true)
 assert.equal(jobs.sourceAudit.sourceScopeComplete,false);assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,false)
})
test('unexecuted passive report metadata cannot change authored native publication eligibility',async()=>{
 const t=transport({mutate:p=>{p.headers['report-to']='a different passive endpoint declaration';p.headers.nel='malformed passive reporting model';p.headers['reporting-endpoints']='network-errors="https://example.invalid/report"'}})
 const jobs=await run({...fixed,fetchImpl:t.fetchImpl})
 assert.equal(jobs.length,2)
 assert.equal(jobs.sourceAudit.originalResponses[0].headers.nel,'malformed passive reporting model')
 assert.equal(jobs.sourceAudit.reportingHeadersRetainedAsProvenance,true)
 assert.equal(jobs.sourceAudit.reportingExecutionQualified,false)
})

for(const[name,change,status,kind]of[
 ['403',p=>{p.status=403},403,'blocked_or_access_denied'],
 ['429',p=>{p.status=429},429,'blocked_or_access_denied'],
 ['unreviewedredirect',p=>{p.status=302;p.headers.location='https://other.example/'},302,'surface_drift_or_fail_closed'],
 ['wrongfinalURL',p=>{p.url='https://other.example/about'},200,'coverage_gap'],
 ['wrongMIME',p=>{p.headers['content-type']='text/htmlx'},200,'coverage_gap'],
]){
 test(name+' is refused before opening a rejected entity reader',async()=>{
  const p=structuredClone(current.packets[0]);change(p)
  const stats={calls:0,readers:0,reads:0,cancels:0};let failure
  const body={getReader(){stats.readers++;return{read(){stats.reads++;return Promise.resolve({done:true})},cancel(){stats.cancels++},releaseLock(){}}},cancel(){stats.cancels++;return Promise.resolve()}}
  const fetchImpl=async()=>{stats.calls++;return{status:p.status,url:p.url,headers:new Headers(p.headers),body}}
  try{await run({...fixed,fetchImpl})}catch(error){failure=error}
  assert.ok(failure);assert.equal(stats.readers,0);assert.equal(stats.reads,0);assert.equal(stats.calls,1);assert.equal(stats.cancels,1)
  assert.equal(failure.failureKind,kind)
  const receipt=failure.sourceAudit.originalResponses[0]
  assert.equal(receipt.status,status);assert.equal(receipt.bodyRead,false);assert.equal(receipt.acquisitionComplete,false)
 })
}
test('final full native audit attachment preserves an opaque late caller abort',async()=>{
 const owner=new AbortController(),reason=Object.freeze({caller:'sociowash-final-audit'}),t=transport({prefix:false})
 const define=Object.defineProperty
 let failure,triggered=false
 Object.defineProperty=(target,key,descriptor)=>{
  const result=Reflect.apply(define,Object,[target,key,descriptor])
  if(key==='nativeCollectionEvidence'&&descriptor.value?.independentNativeClosingReconciled===true){triggered=true;owner.abort(reason)}
  return result
 }
 try{try{await run({...fixed,signal:owner.signal,fetchImpl:t.fetchImpl})}catch(error){failure=error}}finally{Object.defineProperty=define}
 assert.equal(triggered,true);assert.equal(failure,reason)
})

test('late synchronous audit work cannot overrun the source monotonic deadline',async()=>{
 const t=transport({prefix:false}),define=Object.defineProperty,clock=performance.now.bind(performance),clockDescriptor=Object.getOwnPropertyDescriptor(performance,'now')
 let jumped=false,failure
 define(performance,'now',{configurable:true,value:()=>clock()+(jumped?90001:0)})
 Object.defineProperty=(target,key,descriptor)=>{
  const result=Reflect.apply(define,Object,[target,key,descriptor])
  if(key==='nativeCollectionEvidence'&&descriptor.value?.independentNativeClosingReconciled===true)jumped=true
  return result
 }
 try{try{await run({...fixed,fetchImpl:t.fetchImpl})}catch(error){failure=error}}finally{
  Object.defineProperty=define
  if(clockDescriptor)define(performance,'now',clockDescriptor);else delete performance.now
 }
 assert.equal(jumped,true);assert.ok(failure);assert.match(failure.message,/source deadline exceeded/)
})
