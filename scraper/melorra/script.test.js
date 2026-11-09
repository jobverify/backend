import test from 'node:test'
import assert from 'node:assert/strict'
import {run,createMelorraScraper} from './script.js'
const gap=e=>{assert.equal(e.code,'MELORRA_COVERAGE_GAP');assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true}
test('offline source is evidence-bearing coverage gap',async()=>{await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)})
test('factory aliases retain dependency injection',async()=>{for(const factory of [createMelorraScraper])await assert.rejects(factory({fetchImpl:async()=>{throw Error('offline')}}).run(),gap)})
test('aggregate source deadline includes fetch and body',async()=>{for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,text:()=>new Promise(()=>{})})])await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)})
test('exact caller abort reason survives before, fetch and body cancellation',async()=>{for(const stage of ['before','fetch','body']){const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}return {url,status:200,text:()=>{c.abort(reason);return new Promise(()=>{})}}}}),e=>e===reason)}})
test('bounded streamed bodies are cancelled at cap and deadline',async()=>{for(const oversized of [true,false]){let cancelled=false;await assert.rejects(run({timeoutMs:15,fetchImpl:async url=>({url,status:200,body:{getReader:()=>({read:()=>oversized?Promise.resolve({done:false,value:new Uint8Array(3000001)}):new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock(){}})}})}),gap);assert.equal(cancelled,true)}})
test('actual Response requires exact final URL',async()=>{const response=new Response('<html>no redirect</html>',{status:200});Object.defineProperty(response,'url',{value:'https://unrelated.example/'});await assert.rejects(run({fetchImpl:async()=>response}),gap)})

import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const receipts=['official-pages.json','about-pages.json','linkedin-pages.json'].flatMap(file=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+file+'.gz',import.meta.url))))).filter(r=>r.body)
const replay=items=>async url=>{const receipt=items.find(r=>r.url===url);assert.ok(receipt,'unrecorded URL '+url);const r=new Response(receipt.body,{status:receipt.status});Object.defineProperty(r,'url',{value:receipt.finalUrl});return r}
test('actual Melorra employer observations are incomplete rather than verified empty',async()=>{const jobs=await run({fetchImpl:replay(receipts)});const e=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(e.listingComplete,false);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false);assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,5)})
test('employer identity, active no-match, exact scope and changed native vacancies require review',async()=>{for(const [url,edit] of [
 ['https://www.melorra.com/',s=>s.replaceAll('https://www.linkedin.com/company/melorra/','https://www.linkedin.com/company/different/')],
 ['https://www.linkedin.com/company/melorra',s=>s.replaceAll('urn:li:organization:13238231','urn:li:organization:7')],
 ['https://www.linkedin.com/jobs/search/?f_C=13238231&location=India',s=>s.replace('value="13238231"','value="7"')],
 ['https://www.linkedin.com/jobs/search/?f_C=13238231&location=India',s=>s.replace(/<h1\b/,'<h1 hidden')],
 ['https://www.linkedin.com/jobs/search/?f_C=13238231&location=Worldwide',s=>s+'<div class="job-search-card">New vacancy</div>'],
 ])await assert.rejects(run({fetchImpl:replay(receipts.map(r=>r.url===url?{...r,body:edit(r.body)}:r))}),gap)})

test('new structured native vacancies require review and unread response bodies are cancelled',async()=>{
 const changed=receipts.map(r=>r.url==='https://www.melorra.com/'?{...r,body:r.body+'<script type="application/ld+json">{"@type":"JobPosting","title":"New role"}</script>'}:r)
 await assert.rejects(run({fetchImpl:replay(changed)}),gap)
 for(const status of [403,429,200]){let cancelled=false;const r=new Response('unopened',{status});Object.defineProperty(r,'url',{value:status===200?'https://other.example/':'https://www.melorra.com/'});r.body.cancel=async()=>{cancelled=true};await assert.rejects(run({fetchImpl:async()=>r}),gap);assert.equal(cancelled,true)}
})

test('retained actual receipt body hashes and compressed envelopes verify',()=>{const manifest=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)));for(const row of manifest.files){const bytes=readFileSync(new URL('./fixtures/'+row.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(createHash('sha256').update(gunzipSync(bytes)).digest('hex'),row.uncompressedSHA256)}for(const row of manifest.responses){const receipt=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+row.file,import.meta.url)))).find(r=>r.url===row.url);assert.equal(createHash('sha256').update(receipt.body).digest('hex'),row.bodySHA256);assert.equal(receipt.finalUrl,row.finalUrl)}})

test('new country, publication or expiry microdata cannot be ignored by native observations',async()=>{for(const field of ['addressCountry','datePosted','validThrough']){const changed=receipts.map(r=>r.url.includes('/jobs/search/')?{...r,body:r.body+'<meta itemprop="'+field+'" content="new native job fact">'}:r);await assert.rejects(run({fetchImpl:replay(changed)}),gap)}})
