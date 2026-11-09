import test from 'node:test'
import assert from 'node:assert/strict'
import {run,createPangeaTechScraper,createPangeatechScraper} from './script.js'
const gap=e=>{assert.equal(e.code,'PANGEATECH_COVERAGE_GAP');assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true}
test('offline source is evidence-bearing coverage gap',async()=>{await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)})
test('factory aliases retain dependency injection',async()=>{for(const factory of [createPangeaTechScraper,createPangeatechScraper])await assert.rejects(factory({fetchImpl:async()=>{throw Error('offline')}}).run(),gap)})
test('aggregate source deadline includes fetch and body',async()=>{for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})])await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)})
test('exact caller abort reason survives before, fetch and body cancellation',async()=>{for(const stage of ['before','fetch','body']){const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}return {url,status:200,text:()=>{c.abort(reason);return new Promise(()=>{})}}}}),e=>e===reason)}})
test('bounded streamed bodies are cancelled at cap and deadline',async()=>{for(const oversized of [true,false]){let cancelled=false;await assert.rejects(run({timeoutMs:15,fetchImpl:async url=>({url,status:200,body:{getReader:()=>({read:()=>oversized?Promise.resolve({done:false,value:new Uint8Array(3000001)}):new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock(){}})}})}),gap);assert.equal(cancelled,true)}})
test('actual Response requires exact final URL',async()=>{const response=new Response('<html>no redirect</html>',{status:200});Object.defineProperty(response,'url',{value:'https://unrelated.example/'});await assert.rejects(run({fetchImpl:async()=>response}),gap)})
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const corporate=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/official-pages.json.gz',import.meta.url))))
const response=(receipt)=>{const r=new Response(receipt.body,{status:receipt.status});Object.defineProperty(r,'url',{value:receipt.finalUrl});return r}
test('actual corporate receipts recover active .net careers handoff before native fetch',async()=>{const visited=[];await assert.rejects(run({fetchImpl:async url=>{visited.push(url);const receipt=corporate.find(r=>r.url===url);if(!receipt)throw Error('native unavailable');return response(receipt)}}),e=>{gap(e);assert.equal(e.inventoryEvidence.firstParty,true);assert.equal(e.retainedResponses.length,2);return true});assert.deepEqual(visited,['https://pangeatech.net/','https://pangeatech.net/meet-pangea/the-tribe','https://www.linkedin.com/company/pangea-tech'])})
test('hidden, inert, comment, template, content-visibility careers links cannot authorize handoff',async()=>{for(const wrap of [x=>'<div hidden>'+x+'</div>',x=>'<div inert>'+x+'</div>',x=>'<!--'+x+'-->',x=>'<template>'+x+'</template>',x=>'<div style="content-visibility:hidden">'+x+'</div>']){const home={...corporate[0],body:'<footer>PangeaTech Solution Pvt Ltd.</footer>'+wrap('<a href="/meet-pangea/the-tribe">The Tribe</a>')};const seen=[];await assert.rejects(run({fetchImpl:async url=>{seen.push(url);return response(home)}}),gap);assert.equal(seen.length,1)}})
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const native=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-employer-jobs.json.gz',import.meta.url))))
const replay=receipts=>async url=>{const r=receipts.find(r=>r.url===url);assert.ok(r,'unrecorded URL '+url);return response(r)}
test('actual native scoped no-match receipts remain discovery only with unknown company totals',async()=>{const jobs=await run({fetchImpl:replay([...corporate,...native]),now:'2026-10-23T08:00:00Z'});assert.equal(jobs.length,0);const e=readInventoryEvidence(jobs);assert.equal(e.status,'discovery-only');assert.equal(e.listingComplete,false);assert.equal(e.firstParty,true);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.pagesFetched,5);assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,5);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)})
test('native employer, country scope, active no-match and newly appearing roles fail closed when changed',async()=>{
 for(const [index,edit] of [
  [0,x=>x.replaceAll('urn:li:organization:73024337','urn:li:organization:7')],
  [0,x=>x.replaceAll('pangeatech%2Enet','pangeatech%2Eeu')],
  [1,x=>x.replace('value="73024337"','value="7"')],
  [1,x=>x.replace(/<h1\b/, '<h1 hidden')],
  [1,x=>x+'<div class="job-search-card">New role requiring detail review</div>'],
 ]) {const receipts=native.map((r,i)=>i===index?{...r,body:edit(r.body)}:r);await assert.rejects(run({fetchImpl:replay([...corporate,...receipts])}),gap)}
})
test('one deadline covers cumulative fetch and body time',async()=>{await assert.rejects(run({timeoutMs:20,fetchImpl:async url=>{await new Promise(r=>setTimeout(r,12));return {url,status:200,text:async()=>{await new Promise(r=>setTimeout(r,15));return corporate[0].body}}}}),gap)})
test('retained exact browser bodies and compressed receipt hashes verify',()=>{const manifest=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)));for(const file of manifest.files){const bytes=readFileSync(new URL('./fixtures/'+file.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert.equal(createHash('sha256').update(gunzipSync(bytes)).digest('hex'),file.uncompressedSHA256)}for(const item of manifest.responses){const receipt=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+item.file,import.meta.url)))).find(r=>r.url===item.url);assert.equal(createHash('sha256').update(receipt.body).digest('hex'),item.bodySHA256);assert.equal(Buffer.byteLength(receipt.body),item.bodyBytes);assert.equal(receipt.finalUrl,item.finalUrl);assert.equal(receipt.status,item.status)}})
