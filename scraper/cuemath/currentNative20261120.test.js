import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-drift-20261120.json.gz',import.meta.url))))
test('current retained Cuemath screening remains unknown vacancy inventory, without translating applicant regions into worksites',async()=>{
 let reads=0
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const packet=fixture.responses.find(p=>p.requestedURL===url);assert.ok(packet);assert.equal(init.method,'GET');reads++
  return Object.defineProperty(new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }}),error=>{
  assert.equal(error.failureKind,'source_inventory_unavailable')
  assert.equal(error.nativeCollectionEvidence.observedVacancyCount,null)
  assert.equal(error.nativeCollectionEvidence.companyIndiaTotal,null)
  assert.equal(error.nativeCollectionEvidence.applicationSubmitted,false)
  assert.equal(error.lifecycleCleanupAllowed,false)
  return true
 })
 // Repeated opening bodies are a consistency control, not a new live closing observation.
 assert.equal(reads,6)
})
test('the fresh current Cuemath native opening/closing originals retain unknown inventory and actual intake context',async()=>{
 const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-default-20261120.json.gz',import.meta.url)))),seen=new Map();let calls=0
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const count=seen.get(url)??0;seen.set(url,count+1)
  const p=current.responses.filter(row=>row.requestedURL===url)[count];assert.ok(p);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');calls++
  return Object.defineProperty(new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers}),'url',{value:p.finalURL})
 }}),error=>{
  assert.equal(error.failureKind,'source_inventory_unavailable');assert.equal(error.nativeCollectionEvidence.closingNativeApplicationModelMatches,true)
  assert.equal(error.nativeCollectionEvidence.publicEligibility,null);assert.equal(error.nativeCollectionEvidence.observedVacancyCount,null)
  assert.equal(error.nativeCollectionEvidence.applicationSubmitted,false);assert.equal(error.lifecycleCleanupAllowed,false);return true
 })
 assert.equal(calls,6)
})
