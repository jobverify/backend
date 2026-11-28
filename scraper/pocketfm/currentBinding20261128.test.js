import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {verifyPocketClientBinding} from './currentClientBinding.js'
import {runCurrentPocketFM} from './currentNative20261113.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const HOME='https://pocketfm.com/'
const PARENT=HOME+'_next/static/chunks/0psw89x_a37rc.js?dpl=c9c6b9e'
const RUNTIME=HOME+'_next/static/chunks/turbopack-18_5df4vs6w4n.js?dpl=c9c6b9e'
const FOOTER=HOME+'_next/static/chunks/2g_t-raq8uk-3.js?dpl=c9c6b9e'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-binding-20261128.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const bodies=new Map(fixture.packets.map(packet=>{
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(bytes.length,packet.bytes);assert.equal(sha(bytes),packet.sha256)
 assert.equal(packet.bodyOriginalUnmodified,true);assert.deepEqual(packet.bodyRedactions,[])
 return[packet.url,bytes.toString('utf8')]
}))
const changed=(body,before,after)=>{
 assert.ok(body.includes(before),'The genuine retained mutation target must exist')
 const result=body.replace(before,after);assert.notEqual(result,body);return result
}
const replay=(edit=(_url,body)=>body)=>{
 const requests=[]
 const result=verifyPocketClientBinding(edit(HOME,bodies.get(HOME)),async url=>{
  requests.push(url)
  assert.ok([PARENT,RUNTIME,FOOTER].includes(url),'Only complete actually declared current query URLs may be read: '+url)
  return edit(url,bodies.get(url))
 })
 return{result,requests}
}

test('Pocket FM genuine declared query parent, runtime and selected footer bind without discarding the publisher suffix',async()=>{
 const source=replay(),proof=await source.result
 assert.deepEqual(source.requests,[PARENT,RUNTIME,FOOTER])
 assert.equal(proof.parentURL,PARENT);assert.equal(proof.childURL,FOOTER);assert.equal(proof.runtimeURL,RUNTIME)
 assert.equal(proof.loaderProgramSHA256,'18c8619884e990eca104385e72b2277b0e4ce185f25328552fa85076054d104e')
 assert.equal(proof.footerProgramSHA256,'2e78a0dd8a3fc4c0b3bba37088420582eb87c24001dbc3abe4a81ec237ff33bd')
 assert.equal(proof.browserEquivalenceComplete,false);assert.equal(proof.sourceScopeComplete,false)
 assert.equal(proof.lifecycleCleanupAllowed,false)
})

for(const suffix of['?dpl=unreviewed','?DPL=c9c6b9e','?dpl=c9c6b9e&other=1','?dpl=c9c6b9e&dpl=c9c6b9e','?dpl=c9c6b9e#foreign'])test('Pocket FM rejects an unreviewed complete parent suffix '+suffix,async()=>{
 const source=replay((url,body)=>url===HOME?body.replaceAll('?dpl=c9c6b9e',suffix):body)
 await assert.rejects(source.result,/binding|current|declared/i)
 assert.deepEqual(source.requests,[],'Unknown queries cannot trigger a stripped or alternative URL read')
})

const parentTag=/<script\b[^>]*\bsrc="\/_next\/static\/chunks\/0psw89x_a37rc\.js\?dpl=c9c6b9e"[^>]*><\/script>/g
const runtimeTag=/<script\b[^>]*\bsrc="\/_next\/static\/chunks\/turbopack-18_5df4vs6w4n\.js\?dpl=c9c6b9e"[^>]*><\/script>/g
for(const[name,pattern,edit]of[
 ['duplicate parent',parentTag,tag=>tag+tag],
 ['parent in a template',parentTag,tag=>'<template>'+tag+'</template>'],
 ['parent in a comment',parentTag,tag=>'<!--'+tag+'-->'],
 ['module parent',parentTag,tag=>tag.replace('<script ','<script type="module" ')],
 ['duplicate runtime',runtimeTag,tag=>tag+tag],
 ['runtime in a template',runtimeTag,tag=>'<template>'+tag+'</template>'],
 ['runtime in a comment',runtimeTag,tag=>'<!--'+tag+'-->'],
 ['data-only runtime',runtimeTag,tag=>tag.replace('<script ','<script type="application/json" ')],
 ['module runtime',runtimeTag,tag=>tag.replace('<script ','<script type="module" ')],
 ['nomodule runtime',runtimeTag,tag=>tag.replace('<script ','<script nomodule ')],
 ['foreign runtime',runtimeTag,tag=>tag.replace('/_next/','https://other.example/_next/')],
])test('Pocket FM current finite declaration rejects '+name,async()=>{
 const home=bodies.get(HOME),matches=[...home.matchAll(pattern)];assert.equal(matches.length,1)
 const source=replay((url,body)=>url===HOME?changed(body,matches[0][0],edit(matches[0][0])):body)
 await assert.rejects(source.result,/binding|current|declaration|runtime/i)
 assert.ok(!source.requests.includes(FOOTER),'Unqualified executable ownership cannot reach the selected footer')
})

for(const[name,statement]of[
 ['asset suffix override','self.TURBOPACK_ASSET_SUFFIX="?dpl=other"'],
 ['chunk base override','self.TURBOPACK_CHUNK_BASE_PATH="https://other.example/"'],
])test('Pocket FM current static fallback rejects '+name,async()=>{
 const source=replay((url,body)=>url===HOME?changed(body,'</head>','<script>'+statement+'</script></head>'):body)
 await assert.rejects(source.result,/binding|current|override/i)
 assert.ok(!source.requests.includes(FOOTER))
})

for(const[name,target,edit]of[
 ['parent complete bytes',PARENT,body=>body+'\n/* unreviewed current tuple */'],
 ['selected loader target',PARENT,body=>changed(body,'t(516114)','t(999999)')],
 ['runtime complete bytes',RUNTIME,body=>body+'\n/* unreviewed runtime */'],
 ['runtime suffix construction',RUNTIME,body=>changed(body,'`${t}${r}${n}`','`${t}${r}`')],
 ['footer complete bytes',FOOTER,body=>body+'\n/* unreviewed footer */'],
 ['footer employer',FOOTER,body=>changed(body,'https://jobs.lever.co/pocketfm','https://jobs.lever.co/other-employer')],
])test('Pocket FM current finite programmes reject '+name,async()=>{
 const source=replay((url,body)=>url===target?edit(body):body)
 await assert.rejects(source.result,/binding|program|current|runtime/i)
 assert.deepEqual(source.requests,[PARENT,RUNTIME,FOOTER].slice(0,[PARENT,RUNTIME,FOOTER].indexOf(target)+1))
})

test('Pocket FM current declared program read failure preserves the original transport error without an alternate URL',async()=>{
 const reason=Object.assign(Error('retained ordinary public response denial'),{httpStatus:403,abortRetries:true}),requests=[]
 await assert.rejects(verifyPocketClientBinding(bodies.get(HOME),async url=>{requests.push(url);throw reason}),error=>error===reason)
 assert.deepEqual(requests,[PARENT])
})

// This is deliberately a composition control: the four genuine current public
// authority responses are paired with the unmodified November21 native graph.
// It establishes parser compatibility/holds, not a new live native inventory.
const historical=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-registered-20261121.json.gz',import.meta.url))))
const nativeReplay=(edit=(_url,body)=>body)=>{
 const occurrences=new Map(),calls=[]
 return{calls,fetchPage:async url=>{
  const visit=(occurrences.get(url)??0)+1;occurrences.set(url,visit);calls.push(url)
  if(bodies.has(url))return{url,status:200,html:edit(url,bodies.get(url),visit)}
  const packet=historical.packets.filter(row=>row.url===url)[visit-1]
  assert.ok(packet,'Only the exact retained historical native response graph may be used: '+url+' #'+visit)
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(bytes),packet.sha256)
  return{url:packet.finalURL,status:packet.status,html:edit(url,bytes.toString('utf8'),visit)}
 }}
}

test('Pocket FM new genuine authority keeps every historical full native role and company/cleanup hold',async()=>{
 const source=nativeReplay(),jobs=await runCurrentPocketFM(source)
 assert.deepEqual(jobs.map(job=>job.jobId),historical.expectedJobs.map(job=>job.jobId))
 for(const expected of historical.expectedJobs){
  const job=jobs.find(row=>row.jobId===expected.jobId)
  assert.equal(job.country,'India');assert.equal(job.sourceNativeRecord.country,'IN')
  assert.equal(job.postingDate,expected.postingDate);assert.equal(sha(job.sourceDescription),expected.sourceDescriptionSHA256)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readSourceObservationEvidence(jobs,'pocketfm').observedRecordCount,historical.observedNativeRows)
 assert.equal(readSourceObservationEvidence(jobs,'pocketfm').sourceScopeComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.sourceCompanyWideScopeComplete,false)
 assert.deepEqual(jobs.nativeCollectionEvidence.failures,[])
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(source.calls.filter(url=>url===RUNTIME).length,2,'Both opening and closing verify the full current runtime')
})

test('Pocket FM current authority cannot turn an unqualified empty native response into successful zero inventory',async()=>{
 const source=nativeReplay((url,body)=>url.startsWith('https://api.lever.co/')?'[]':body)
 await assert.rejects(runCurrentPocketFM(source),/empty|inventory/i)
 assert.equal(source.calls.filter(url=>url.startsWith('https://api.lever.co/')).length,1)
})

test('Pocket FM closing current runtime change stops publication after opening native observations',async()=>{
 const source=nativeReplay((url,body,visit)=>url===RUNTIME&&visit===2?body+';unreviewedClosingAuthority()':body)
 await assert.rejects(runCurrentPocketFM(source),/runtime|binding|program/i)
 assert.equal(source.calls.filter(url=>url===RUNTIME).length,2)
 assert.equal(source.calls.filter(url=>url.startsWith('https://api.lever.co/')).length,1)
})
