import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runCurrentValutico} from './currentNative20261121.js'
import {API_ACCOUNT} from './nativeData20261121.js'

const redirects=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-redirect-20261127.json.gz',import.meta.url)))).responses
for(const row of redirects)assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
const historical=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/current-native-prefix-20261121.json.gz',import.meta.url)))).responses
const native=new Map(historical.map(row=>[row.kind,{...row,body:Buffer.from(row.bodyBase64,'base64').toString('utf8')}]))
const legacy='https://valutico-2.workable.com/jobs/5856345',numeric='https://apply.workable.com/valutico-2/jobs/5856345',modern='https://apply.workable.com/valutico-2/j/720E76FE8A'

// Current redirect originals are replayed before a historical, explicitly
// bounded prefix. The test stops at the next uncaptured role; it does not
// fabricate a complete current employer inventory or closing read.
function transport(change=()=>{}){
 const requests=[],rows=new Map(redirects.map(row=>[row.requestedUrl,{...row,headers:{...row.headers}}]))
 for(const [kind,row]of native){
  const requested=kind==='account'?API_ACCOUNT:row.receipt.requestedURL
  if(requested===legacy)rows.set(modern,{url:modern,status:200,headers:row.receipt.headers,body:row.body})
  else rows.set(requested,{url:kind==='account'?API_ACCOUNT:row.receipt.finalURL,status:row.receipt.status,headers:row.receipt.headers,body:row.body})
 }
 change(rows)
 return{requests,async fetch(url,init){
  url=String(url);requests.push(url)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const row=rows.get(url)
  if(!row)throw Error('CONTROLLED_UNOBSERVED_CURRENT_COUNTERPART '+url)
  const response=new Response(row.body,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.url})
  return response
 }}
}
async function attempt(change,extra={}){
 const io=transport(change)
 try{await runCurrentValutico({fetchImpl:io.fetch,requestIntervalMs:0,...extra});assert.fail('The unobserved remaining role must stay held')}
 catch(error){return{error,requests:io.requests}}
}

test('real same-account numeric redirect reaches the exact modern role and retains full foreign DTO',async()=>{
 const {error,requests}=await attempt()
 const audit=error.nativeCollectionEvidence,first=audit?.nativeRoleObservations.find(row=>row.legacyNativeId===5856345)
 assert.deepEqual(first?.nativeJob,JSON.parse(native.get('job5856345').body),error.message)
 assert.deepEqual(requests.slice(requests.indexOf(legacy),requests.indexOf(legacy)+3),[legacy,numeric,modern])
 assert.equal(first.nativeCountry,'United Kingdom');assert.equal(first.sourceCountryQualifiedForIndia,false)
 assert.equal(first.nativePublicationDate,'2026-06-02T00:00:00.000Z')
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.wholeNativeRoleModelsClosingReconciled,false)
})

for(const [label,location]of[
 ['another numeric ID','https://apply.workable.com/valutico-2/jobs/5856346'],
 ['foreign account','https://apply.workable.com/foreign/jobs/5856345'],
 ['numeric query',numeric+'?country=IN'],
 ['numeric fragment',numeric+'#job'],
 ['numeric credentials','https://attacker@apply.workable.com/valutico-2/jobs/5856345'],
])test('legacy redirect to '+label+' is never followed',async()=>{
 const {error,requests}=await attempt(rows=>{rows.get(legacy).headers.location=location})
 assert.ok(error);assert.deepEqual(requests.slice(requests.indexOf(legacy)),[legacy])
})

for(const [label,location]of[
 ['foreign relative account','/foreign/j/720E76FE8A'],
 ['foreign absolute account','https://apply.workable.com/foreign/j/720E76FE8A'],
 ['scheme-relative host','//foreign.invalid/valutico-2/j/720E76FE8A'],
 ['modern query','/valutico-2/j/720E76FE8A?country=IN'],
 ['loop',numeric],
])test('numeric redirect to '+label+' is never followed',async()=>{
 const {error,requests}=await attempt(rows=>{rows.get(numeric).headers.location=location})
 assert.ok(error);assert.deepEqual(requests.slice(requests.indexOf(legacy)),[legacy,numeric])
})

for(const status of [403,429])test('numeric '+status+' remains terminal before the modern role',async()=>{
 const {error,requests}=await attempt(rows=>{rows.get(numeric).status=status})
 assert.equal(error.httpStatus,status);assert.deepEqual(requests.slice(requests.indexOf(legacy)),[legacy,numeric])
})

test('different shortcode cannot donate the original role shell',async()=>{
 const other='https://apply.workable.com/valutico-2/j/AAAAAAAAAA'
 const {error,requests}=await attempt(rows=>{rows.get(numeric).headers.location='/valutico-2/j/AAAAAAAAAA';rows.set(other,{...rows.get(modern),url:other})})
 assert.match(error.message,/canonical/);assert.ok(requests.includes(other));assert.ok(!requests.includes(API_ACCOUNT))
})

for(const reason of [Object.freeze({opaque:'redirect caller'}),null])test('caller cancellation at numeric handoff preserves exact reason '+String(reason),async()=>{
 const controller=new AbortController,io=transport(),base=io.fetch
 io.fetch=async(url,init)=>{const response=await base(url,init);if(String(url)===numeric)controller.abort(reason);return response}
 let caught=Symbol()
 try{await runCurrentValutico({fetchImpl:io.fetch,requestIntervalMs:0,signal:controller.signal})}catch(error){caught=error}
 assert.equal(caught,reason);assert.ok(!io.requests.includes(modern))
})
