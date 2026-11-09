import test from 'node:test'
import assert from 'node:assert/strict'
import {run,createXto10xScraper} from '../scraper/xto10x/script.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const load=name=>JSON.parse(gunzipSync(readFileSync(new URL('../scraper/xto10x/fixtures/'+name+'.json.gz',import.meta.url))))
const receipts=()=>['official-pages','native-employer-jobs','native-job-api'].flatMap(load)
const replay=(mutate=r=>r)=>async url=>{
 const original=receipts().find(r=>r.url===url);assert.ok(original,'Unexpected request '+url)
 const r=mutate({...original}),response=new Response(r.body,{status:r.status})
 Object.defineProperty(response,'url',{value:r.finalUrl});return response
}

const gap = error => error.code === 'XTO10X_COVERAGE_GAP' && error.lifecycleCleanupAllowed === false && error.inventoryEvidence.reportedTotal === null
test('xto10x transport failure does not certify an empty employer',async()=>{
 await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)
})
test('xto10x aggregate deadline bounds fetch and body stalls',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})]) await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)
})
test('xto10x exact caller cancellation before and during fetch/body',async()=>{
 for(const stage of ['before','fetch','body']) {
  const controller=new AbortController(),reason={stage}
  if(stage==='before')controller.abort(reason)
  await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{
   if(stage==='fetch'){controller.abort(reason);return new Promise(()=>{})}
   return {url,status:200,text:()=>{controller.abort(reason);return new Promise(()=>{})}}
  }}),error=>error===reason)
 }
})
test('xto10x streamed oversized responses are cancelled',async()=>{
 let cancelled=false
 const response=new Response(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}}))
 Object.defineProperty(response,'url',{value:'https://www.xto10x.com/about'})
 await assert.rejects(run({fetchImpl:async()=>response}),gap)
 assert.equal(cancelled,true)
})
test('xto10x rejects final URL drift on actual Response',async()=>{
 const response=new Response('<h1>xto10x</h1>');Object.defineProperty(response,'url',{value:'https://other.example/'})
 await assert.rejects(run({fetchImpl:async()=>response}),gap)
})
test('xto10x deadline and caller abort cancel a stalled actual Response stream',async()=>{
 for(const stage of ['deadline','caller']) {
  let cancelled=false
  const controller=new AbortController(),reason={stage}
  const response=new Response(new ReadableStream({start(){if(stage==='caller')setTimeout(()=>controller.abort(reason),5)},cancel(){cancelled=true}}))
  Object.defineProperty(response,'url',{value:'https://www.xto10x.com/about'})
  await assert.rejects(run({fetchImpl:async()=>response,signal:controller.signal,timeoutMs:20}),stage==='caller'?error=>error===reason:gap)
  assert.equal(cancelled,true)
 }
})
test('xto10x current generic corporate invitation and independent native scoped searches leave company inventory unknown',async()=>{
 const jobs=await run({fetchImpl:replay()});assert.equal(jobs.length,2)
 const e=readInventoryEvidence(jobs)
 assert.equal(e.status,'coverage-gap');assert.equal(e.firstParty,false);assert.equal(e.listingComplete,false)
 assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null)
 assert.equal(jobs.nativeCollectionEvidence.observations.nativeEmployer.organizationID,'14628973')
 assert.equal(jobs.nativeCollectionEvidence.observations.about.specificJob,false)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,7)
 assert.equal(jobs.nativeCollectionEvidence.exclusions.length,0)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeCandidates.map(r=>r.id),['1728041','1728042'])
 assert.ok(jobs.nativeCollectionEvidence.nativeCandidates.every(r=>!r.excluded&&r.nativeEarliestDate.parsed.iso==='2026-08-28T18:30:00.000Z'))
})
test('xto10x factory defaults and per-run injection remain compatible',async()=>{
 const scraper=createXto10xScraper({fetchImpl:async()=>{throw Error('must override')}})
 const jobs=await scraper.run({fetchImpl:replay()})
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,7)
})
test('xto10x active generic career handoff, identity and scoped-search changes fail closed',async()=>{
 const changes=[
  r=>r.url.endsWith('/about')?{...r,body:r.body.replaceAll('mailto:hungryforimpact@xto10x.com','https://new-board.example/')}:r,
  r=>r.url.endsWith('/about')?{...r,body:'<template>'+r.body+'</template>'}:r,
  r=>r.url.endsWith('/about')?{...r,body:'<div style="content-visibility:hidden"><div>'+r.body+'</div></div>'}:r,
  r=>r.url.includes('/company/')?{...r,body:r.body.replaceAll('urn:li:organization:14628973','urn:li:organization:123')}:r,
  r=>({...r,status:403}),
 ]
 for(const change of changes)await assert.rejects(run({fetchImpl:replay(change)}),gap)
})

test('xto10x independent scoped-search drift preserves native jobs with explicit discovery gaps',async()=>{
 for(const change of [r=>r.url.includes('location=India')?{...r,body:r.body.replace('name="f_C"','name="other_company"')}:r,r=>r.url.includes('location=Worldwide')?{...r,body:r.body.replace('</body>','<div class="job-search-card">new role</div></body>')}:r]){
  const jobs=await run({fetchImpl:replay(change)})
  assert.equal(jobs.length,2)
  assert.equal(jobs.nativeCollectionEvidence.independentDiscoveryGaps.length,1)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 }
})
test('xto10x captured gzip and exact raw response hashes match manifest',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../scraper/xto10x/fixtures/capture-manifest.json',import.meta.url)))
 const sha=data=>createHash('sha256').update(data).digest('hex')
 for(const e of manifest.evidence){const gz=readFileSync(new URL('../scraper/xto10x/fixtures/'+e.file,import.meta.url)),raw=gunzipSync(gz);assert.equal(sha(gz),e.sha256);assert.equal(sha(raw),e.uncompressedSha256);const p=JSON.parse(raw);for(const r of e.responses){const actual=p.find(x=>x.url===r.url);assert.equal(actual.finalUrl,r.finalUrl);assert.equal(actual.status,r.status);assert.equal(sha(actual.body),r.bodySHA256)}}
})
test('xto10x employer-authored API identity, status, native dates and country shape drift fail closed',async()=>{
 for(const change of [p=>{p.data.creatorDomainName='agency.example'},p=>{p.data.crawled=1},p=>{p.data.active=0},p=>{p.data.hasExpired=true},p=>{p.data.createdTime=Date.parse('2099-01-01')+1;p.data.createdTimeMs=p.data.createdTime},p=>{p.data.locations[0].country='India'}]){
  await assert.rejects(run({fetchImpl:replay(r=>{if(!r.url.includes('gladiator.'))return r;const p=JSON.parse(r.body);change(p);return {...r,body:JSON.stringify(p)}})}),gap)
 }
})
test('xto10x HTTP/final URL errors cancel unopened actual Response bodies',async()=>{
 for(const failure of ['http','url']){
  let cancelled=false
  const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{status:failure==='http'?403:200})
  Object.defineProperty(response,'url',{value:failure==='url'?'https://other.example/':'https://www.xto10x.com/about'})
  await assert.rejects(run({fetchImpl:async()=>response}),gap)
  assert.equal(cancelled,true)
 }
})
test('xto10x cancels an actual Response arriving after caller abort and keeps exact reason',async()=>{
 let release,cancelled=false
 const controller=new AbortController(),reason={caller:'exact-object'}
 const response=new Response(new ReadableStream({cancel(){cancelled=true}}));Object.defineProperty(response,'url',{value:'https://www.xto10x.com/about'})
 const pending=run({signal:controller.signal,fetchImpl:()=>new Promise(resolve=>{release=resolve})})
 controller.abort(reason)
 await assert.rejects(pending,error=>error===reason)
 release(response)
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancelled,true)
})
