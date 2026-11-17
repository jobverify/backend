import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-direct-20261116.json.gz',import.meta.url))))
const packet=capture.requests[0],bytes=Buffer.from(packet.bodyBase64,'base64'),html=bytes.toString('utf8')
assert.equal(packet.status,200);assert.equal(packet.url,CAREERS_URL)
assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
// The old native API is compatibility evidence only; the new publisher HTML is
// an unchanged original response. A separate default live capture verifies today.
const oldRoot=new URL('./fixtures/current-20261030/',import.meta.url)
const old=JSON.parse(readFileSync(new URL('manifest.json',oldRoot)))
const apiURL='https://boards-api.greenhouse.io/v1/boards/auviknetworks/jobs?content=true'
const api=old.requests.find(row=>row.requestedURL===apiURL)
const apiBytes=gunzipSync(readFileSync(new URL(api.filename,oldRoot)))
const script='<script src="https://boards.greenhouse.io/embed/job_board/js?for=auviknetworks"></script>'
const proof=Symbol.for('jobverify.official-ats-discovery')
const replay=async(mutate=value=>value)=>{
 let reads=0
 const jobs=await run({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  assert.equal(init.redirect,'manual');assert.equal(init.method,'GET');reads++
  const body=url===CAREERS_URL?mutate(html):(assert.equal(url,apiURL),apiBytes)
  return Object.defineProperty(new Response(body,{status:200,headers:{'content-type':url===CAREERS_URL?'text/html':'application/json'}}),'url',{value:url})
 }})
 return {jobs,reads}
}
test('Auvik current original active direct embed binds only its own full native feed',async()=>{
 const {jobs,reads}=await replay()
 assert.equal(reads,4);assert.equal(jobs.length,0)
 assert.equal(jobs[proof].binding.kind,'current-primary-direct-Greenhouse-embed')
 assert.equal(jobs[proof].binding.browserExecutionVerified,false)
 assert.equal(jobs[proof].nativeInventory.observedNativeRoles,13)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
test('Auvik direct embed rejects inert, altered, ambiguous and misplaced declarations',async()=>{
 for(const replacement of ['<!--'+script+'-->','<template>'+script+'</template>','<noscript>'+script+'</noscript>',script.replace('<script ','<script type="application/json" '),script.replace('<script ','<script onload="other()" '),script+script,script.replace('auviknetworks','other'),'<div></div>'+script]){
  await assert.rejects(replay(value=>value.replace(script,replacement)))
 }
 await assert.rejects(replay(value=>value.replace('id="h-view-our-open-roles"','id="unrelated"')))
 await assert.rejects(replay(value=>value.replace('</head>','<style>#grnhse_app{display:none}</style></head>')))
 await assert.rejects(replay(value=>value.replace('</head>','<style>#h-view-our-open-roles{display:none}</style></head>')))
 await assert.rejects(replay(value=>value.replace(script,'<h2 id="h-view-our-open-roles">View our open roles</h2>'+script)))
})

test('Auvik visible binding cannot overlook another executing hidden or case-varied account loader',async()=>{
 const target='https://BOARDS.GREENHOUSE.IO/embed/job_board/js?for=other'
 const metadata=Buffer.from(JSON.stringify({delay:false,attributes:{id:'foreign'},canonicalLink:target})).toString('base64')
 for(const extra of [
  '<script src="'+target+'"></script>',
  '<script hidden src="'+target.toLowerCase()+'"></script>',
  '<script style="display:none" src="'+target.toLowerCase()+'"></script>',
  '<div hidden><script src="'+target.toLowerCase()+'"></script></div>',
  '<script hidden>NPRL.registerScript("'+target+'","foreign","'+metadata+'");</script>',
  '<svg><script href="'+target+'"></script></svg>',
  '<svg><script xlink:href="'+target+'"></script></svg>',
 ]) await assert.rejects(replay(value=>value.replace('</body>',extra+'</body>')))
})

test('Auvik four current original responses preserve six full observations and unresolved India scope',async()=>{
 const current=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/default-direct-20261116.json.gz',import.meta.url))))
 const packets=[...current.requests]
 const jobs=await run({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const packet=packets.shift();assert.equal(packet.requestedURL,url)
  assert.equal(packet.url,url);assert.equal(packet.status,200);assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.url})
 }})
 assert.equal(packets.length,0)
 assert.equal(jobs[proof].nativeInventory.observedNativeRoles,6)
 assert.equal(jobs[proof].nativeInventory.fullContentRoles,6)
 assert.equal(jobs[proof].nativeInventory.unresolvedCountryScope,true)
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
