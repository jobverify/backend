import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-drift-20261120.json.gz',import.meta.url))))
test('current retained Harbinger corporate handoff is admitted by its active employer identity and exact tenant declarations',async()=>{
 const stop=Object.freeze({retainedBoundary:'declared board was not reached in the failed current capture'}),calls=[]
 await assert.rejects(run({fetchImpl:async(url,init)=>{
  calls.push(url);assert.equal(init.method,'GET')
  if(url==='https://harbingergroup.darwinbox.in/ms/candidatev2/main/careers/home')throw stop
  const packet=fixture.responses.find(p=>p.requestedURL===url);assert.ok(packet)
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }}),error=>error===stop)
 assert.equal(calls.length,2)
})
for(const control of ['foreign-tenant','document-base'])test('current Harbinger handoff rejects '+control+' before reading a tenant',async()=>{
 let calls=0
 await assert.rejects(run({fetchImpl:async(url)=>{
  calls++;const packet=fixture.responses.find(p=>p.requestedURL===url);assert.ok(packet)
  const original=Buffer.from(packet.bodyBase64,'base64').toString(),body=control==='foreign-tenant'?original.replaceAll('harbingergroup.darwinbox.in','other.darwinbox.in'):original.replace('</head>','<base href="https://other.example/"></head>')
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }}),error=>/identity\/handoff/.test(error.message))
 assert.equal(calls,1)
})
test('fresh declared Harbinger chain preserves its header-only employer-config403 and stops without a fabricated entity',async()=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-default-20261120.json.gz',import.meta.url))));let calls=0
 await assert.rejects(run({fetchImpl:async(url,init)=>{
  const p=current.responses[calls++];assert.ok(p);assert.equal(url,p.requestedURL);assert.equal(init.method,'GET')
  if(p.bodyUnavailable){assert.equal(p.status,403);assert.equal(p.publisherAccessHeld,true);assert.equal(p.bodyBase64,null)}
  return Object.defineProperty(new Response(p.bodyBase64===null?null:Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),'url',{value:p.finalURL})
 }}),error=>{
  assert.equal(error.status,403);assert.equal(error.failureKind,'blocked_or_access_denied')
  assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.recruitmentObservations.companyIndiaTotal,null);return true
 })
 assert.equal(calls,4)
})
