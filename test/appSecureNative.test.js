import test from 'node:test'
import assert from 'node:assert/strict'
import {run,createAppSecureScraper} from '../scraper/appsecure/script.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const load=name=>JSON.parse(gunzipSync(readFileSync(new URL('../scraper/appsecure/fixtures/'+name+'.json.gz',import.meta.url))))
const receipts=()=>['official-pages','linkedin-pages'].flatMap(load)
const replay=(mutate=r=>r)=>async url=>{
 const original=receipts().find(r=>r.url===url);assert.ok(original,'Unexpected request '+url)
 const r=mutate({...original}),response=new Response(r.body,{status:r.status})
 Object.defineProperty(response,'url',{value:r.finalUrl});return response
}

const gap = error => error.code === 'APPSECURE_COVERAGE_GAP' && error.lifecycleCleanupAllowed === false && error.inventoryEvidence.reportedTotal === null
test('appsecure transport failure does not certify an empty employer',async()=>{
 await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)
})
test('appsecure aggregate deadline bounds fetch and body stalls',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})]) await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)
})
test('appsecure exact caller cancellation before and during fetch/body',async()=>{
 for(const stage of ['before','fetch','body']) {
  const controller=new AbortController(),reason={stage}
  if(stage==='before')controller.abort(reason)
  await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{
   if(stage==='fetch'){controller.abort(reason);return new Promise(()=>{})}
   return {url,status:200,text:()=>{controller.abort(reason);return new Promise(()=>{})}}
  }}),error=>error===reason)
 }
})
test('appsecure streamed oversized responses are cancelled',async()=>{
 let cancelled=false
 const response=new Response(new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}}))
 Object.defineProperty(response,'url',{value:'https://www.appsecure.security/'})
 await assert.rejects(run({fetchImpl:async()=>response}),gap)
 assert.equal(cancelled,true)
})
test('appsecure rejects final URL drift on actual Response',async()=>{
 const response=new Response('<h1>appsecure</h1>');Object.defineProperty(response,'url',{value:'https://other.example/'})
 await assert.rejects(run({fetchImpl:async()=>response}),gap)
})
test('appsecure deadline and caller abort cancel a stalled actual Response stream',async()=>{
 for(const stage of ['deadline','caller']) {
  let cancelled=false
  const controller=new AbortController(),reason={stage}
  const response=new Response(new ReadableStream({start(){if(stage==='caller')setTimeout(()=>controller.abort(reason),5)},cancel(){cancelled=true}}))
  Object.defineProperty(response,'url',{value:'https://www.appsecure.security/'})
  await assert.rejects(run({fetchImpl:async()=>response,signal:controller.signal,timeoutMs:20}),stage==='caller'?error=>error===reason:gap)
  assert.equal(cancelled,true)
 }
})

test('appsecure actual native hiring facts excluded by original public date; company totals stay unknown',async()=>{
 const jobs=await run({fetchImpl:replay(),now:new Date('2026-10-23T10:00:00Z')})
 assert.deepEqual(jobs,[])
 const e=readInventoryEvidence(jobs)
 assert.equal(e.status,'discovery-only');assert.equal(e.firstParty,true);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.listingComplete,false)
 const collection=jobs.nativeCollectionEvidence
 assert.equal(collection.retainedResponses.length,6);assert.equal(collection.lifecycleCleanupAllowed,false)
 assert.equal(collection.observations.nativeEmployer.organizationID,'13392021')
 const fact=collection.exclusions[0]
 assert.equal(fact.id,'7492483018570235905');assert.equal(fact.nativePublicationDate.iso,'2026-08-10T07:32:35.202Z')
 assert.deepEqual(fact.nativeCountries,['India','Singapore']);assert.equal(fact.firstParty,false);assert.equal(fact.activeRequisitionVerified,false)
 assert.match(fact.exclusionReason,/older-than-30-days/)
 assert.equal(collection.retainedResponses.some(r=>r.url.includes('4468771843')),false)
})

test('appsecure exported options and factory override use identical actual response contracts',async()=>{
 const options={fetchImpl:replay(),now:()=> '2026-10-23T10:00:00Z'}
 const jobs=await createAppSecureScraper({fetchImpl:async()=>{throw Error('unused default')}}).run(options)
 assert.deepEqual(jobs.nativeCollectionEvidence.exclusions,(await run(options)).nativeCollectionEvidence.exclusions)
})

test('appsecure active DOM, exact identity, scoped search and new native publication/country/expiry fields fail closed',async()=>{
 const changes=[
  r=>r.url.endsWith('/about')?{...r,body:r.body.replaceAll('mailto:careers@appsecure.security','mailto:other@example.com')}:r,
  r=>r.url.includes('/company/')?{...r,body:r.body.replaceAll('urn:li:organization:13392021','urn:li:organization:123')}:r,
  r=>r.url.includes('location=India')?{...r,body:r.body.replace('name="f_C"','name="other_company"')}:r,
  r=>r.url.includes('location=Worldwide')?{...r,body:r.body.replace('</body>','<div class="job-search-card">new role</div></body>')}:r,
  ...['dateModified','validThrough','jobLocation'].map(field=>r=>r.url.includes('/posts/')?{...r,body:r.body.replace('"datePublished":','"'+field+'":"2026-10-22","datePublished":')}:r),
  r=>r.url.includes('/posts/')?{...r,body:r.body.replace('2026-08-10T07:32:35.202Z','2026-10-22T07:32:35.202Z')}:r,
  r=>r.url.includes('/posts/')?{...r,body:r.body.replaceAll('India or Singapore','Singapore only')}:r,
 ]
 for(const change of changes)await assert.rejects(run({fetchImpl:replay(change)}),gap)
 for(const open of ['<template>','<div hidden>','<div inert>','<div style="content-visibility:hidden"><div>'])await assert.rejects(run({fetchImpl:replay(r=>r.url.includes('/posts/')?{...r,body:open+r.body+'</div></div></template>'}:r)}),gap)
})

test('appsecure unread HTTP, URL drift and late caller abort response bodies are cancelled',async()=>{
 for(const stage of ['http','url','abort']){
  let cancelled=false;const caller=new AbortController(),reason={stage}
  const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{status:stage==='http'?503:200})
  Object.defineProperty(response,'url',{value:stage==='url'?'https://other.example/':'https://www.appsecure.security/'})
  await assert.rejects(run({signal:caller.signal,fetchImpl:async()=>{if(stage==='abort')caller.abort(reason);return response}}),stage==='abort'?error=>error===reason:gap)
  assert.equal(cancelled,true)
 }
})

test('appsecure newly exposed active native job schema and date/country/expiry microdata require review',async()=>{
 const fragments=[
  '<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","datePosted":"2026-10-23","validThrough":"2026-10-24","jobLocation":{"address":{"addressCountry":"India"}}}]}</script>',
  '<section itemscope itemtype="https://schema.org/JobPosting">New role</section>',
  '<meta itemprop="addressCountry" content="India">',
  '<span itemprop="datePosted">2026-10-23</span>',
  '<span itemprop="validThrough">2026-10-24</span>',
  '<meta property="job:expiry" content="2026-10-24">',
 ]
 for(const surface of ['https://www.appsecure.security/','https://www.appsecure.security/about','/company/','/posts/','location=India','location=Worldwide'])for(const fragment of fragments){
  await assert.rejects(run({fetchImpl:replay(r=>(surface.startsWith('https:')?r.url===surface:r.url.includes(surface))?{...r,body:r.body.replace('</body>',fragment+'</body>')}:r)}),gap)
 }
 for(const fragment of ['<script type="application/ld+json">{"datePosted":"2026-10-23"}</script>','<script type="application/ld+json">{"addressCountry":"India"}</script>'])await assert.rejects(run({fetchImpl:replay(r=>r.url.includes('location=India')?{...r,body:r.body.replace('</body>',fragment+'</body>')}:r)}),gap)
})

test('appsecure raw gzip and response SHA manifest verify exact captured evidence',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../scraper/appsecure/fixtures/capture-manifest.json',import.meta.url)))
 const sha=data=>createHash('sha256').update(data).digest('hex')
 for(const e of manifest.evidence){const gzip=readFileSync(new URL('../scraper/appsecure/fixtures/'+e.file,import.meta.url)),raw=gunzipSync(gzip);assert.equal(sha(gzip),e.sha256);assert.equal(sha(raw),e.uncompressedSha256);const rows=JSON.parse(raw);for(const r of e.responses){const actual=rows.find(x=>x.url===r.url);assert.equal(actual.finalUrl,r.finalUrl);assert.equal(actual.status,r.status);assert.equal(sha(actual.body),r.bodySHA256)}}
})


