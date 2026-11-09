import assert from 'node:assert/strict'
import test from 'node:test'
import {createCogniTensorScraper,run} from './script.js'
const response=(url,body,status=200)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:url});return r}
for(const [name,invoke] of [['factory',o=>createCogniTensorScraper(o).run()],['export',run]])test(name+' injects transport and rejects failed inventory',async()=>{
 let called=0
 await assert.rejects(invoke({fetchImpl:async()=>{called++;throw Error('offline')}}),e=>e.code==='COGNITENSOR_COVERAGE_GAP'&&e.lifecycleCleanupAllowed===false)
 assert.equal(called,1)
})
test('aggregate deadline bounds pending fetch and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async url=>response(url,new ReadableStream({start(){}}))])await assert.rejects(run({fetchImpl,timeoutMs:10}),/deadline/i)
})
test('caller abort returns exact reason',async()=>{const c=new AbortController(),reason=Error('caller');const pending=run({signal:c.signal,fetchImpl:()=>new Promise(()=>{})});c.abort(reason);await assert.rejects(pending,e=>e===reason)})
test('failed status and changed final URL cancel unread bodies',async()=>{
 for(const changed of [false,true]){let canceled=false;await assert.rejects(run({fetchImpl:async url=>response(changed?url+'other':url,new ReadableStream({cancel(){canceled=true}}),changed?200:403)}));assert.equal(canceled,true)}
})
test('stream byte limit cancels body',async()=>{let canceled=false;await assert.rejects(run({fetchImpl:async url=>response(url,new ReadableStream({pull(c){c.enqueue(new Uint8Array(4000001))},cancel(){canceled=true}}))}),/coverage gap/);assert.equal(canceled,true)})

test('late response after caller abort is canceled unread',async()=>{
 const c=new AbortController(),reason={stage:'late'},url='https://www.cognitensor.com/';let deliver,canceled=false
 const pending=run({signal:c.signal,fetchImpl:()=>new Promise(resolve=>{deliver=resolve})});c.abort(reason);await assert.rejects(pending,e=>e===reason)
 deliver(response(url,new ReadableStream({cancel(){canceled=true}})));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(canceled,true)
})
test('pre-abort and body abort preserve exact caller reason',async()=>{
 for(const stage of ['before','body']){const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async url=>({url,status:200,text(){c.abort(reason);return new Promise(()=>{})}})}),e=>e===reason)}
})
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const dir=new URL('./fixtures/',import.meta.url)
const manifest=JSON.parse(readFileSync(new URL('capture-manifest.json',dir)))
const receipts=()=>manifest.evidence.flatMap(f=>JSON.parse(gunzipSync(readFileSync(new URL(f.file,dir)))))
const replay=(mutate=r=>r)=>async url=>{const r=mutate({...receipts().find(r=>r.url===url)});assert.ok(r.body,'Unexpected request '+url);return response(r.finalUrl,r.body,r.status)}
test('captured active corporate client and exact native no-match observations keep inventory unknown',async()=>{
 const jobs=await run({fetchImpl:replay()});assert.equal(jobs.length,0);const e=readInventoryEvidence(jobs);assert.equal(e.status,'discovery-only');assert.equal(e.firstParty,true);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.listingComplete,false);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false);assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,6)
 const expired=receipts().find(r=>r.url.endsWith('/4457463203'));assert.match(expired.finalUrl,/expired_jd_redirect/)
})
test('changed corporate client, native employer and checked scope fail closed',async()=>{
 for(const mutate of [
  r=>r.url.includes('/assets/')?{...r,body:r.body+'//new role metadata'}:r,
  r=>r.url.includes('/company/cognitensor')?{...r,body:r.body.replaceAll('urn:li:organization:11509078','urn:li:organization:1')}:r,
  r=>r.url.includes('/search/')?{...r,body:'<div hidden>'+r.body+'</div>'}:r,
  r=>r.url.includes('/search/')?{...r,body:'<div inert>'+r.body+'</div>'}:r,
  r=>r.url.includes('/search/')?{...r,body:'<template>'+r.body+'</template>'}:r,
  r=>r.url.includes('/search/')?{...r,body:'<div style="content-visibility:hidden !important">'+r.body+'</div>'}:r,
  r=>r.url.includes('/search/')?{...r,body:r.body+'<article class="job-search-card">newrole</article>'}:r,
  r=>r.url.includes('/search/')?{...r,body:r.body+'<meta itemprop="addressCountry" content="India">'}:r,
  r=>r.url.includes('/search/')?{...r,body:r.body+'<span itemprop="addressCountry">India</span>'}:r,
  r=>r.url.includes('/search/')?{...r,body:r.body+'<article itemscope itemtype="https://schema.org/JobPosting">New role</article>'}:r,
  r=>r.url.includes('/search/')?{...r,body:r.body+'<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23"}</script>'}:r,
  r=>r.url.endsWith('.com/')?{...r,body:'<template>'+r.body+'</template>'}:r,
 ])await assert.rejects(run({fetchImpl:replay(mutate)}),e=>e.code==='COGNITENSOR_COVERAGE_GAP')
})
test('every raw gzip receipt and observation has reproducible exact SHA256',()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex')
 for(const f of [...manifest.evidence,...manifest.navigationObservations]){
  const gz=readFileSync(new URL(f.file,dir)),raw=gunzipSync(gz);assert.equal(hash(gz),f.sha256);assert.equal(hash(raw),f.uncompressedSha256)
  if(f.responses){const rows=JSON.parse(raw);for(const r of f.responses){const row=rows.find(x=>x.url===r.url);assert.equal(hash(row.body),r.bodySHA256);assert.equal(row.finalUrl,r.finalUrl);assert.equal(row.status,r.status)}}
 }
})
