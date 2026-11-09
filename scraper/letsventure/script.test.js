import test from 'node:test'
import assert from 'node:assert/strict'
import {run,createLetsVentureScraper} from './script.js'
const gap=e=>{assert.equal(e.code,'LETSVENTURE_COVERAGE_GAP');assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true}
test('offline source is evidence-bearing coverage gap',async()=>{await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)})
test('factory aliases retain dependency injection',async()=>{for(const factory of [createLetsVentureScraper])await assert.rejects(factory({fetchImpl:async()=>{throw Error('offline')}}).run(),gap)})
test('aggregate source deadline includes fetch and body',async()=>{for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{},releaseLock(){}})}})])await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)})
test('exact caller abort reason survives before, fetch and body cancellation',async()=>{for(const stage of ['before','fetch','body']){const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}return {url,status:200,body:{getReader:()=>({read:()=>{c.abort(reason);return new Promise(()=>{})},cancel:async()=>{},releaseLock(){}})}}}}),e=>e===reason)}})
test('bounded streamed bodies are cancelled at cap and deadline',async()=>{for(const oversized of [true,false]){let cancelled=false;await assert.rejects(run({timeoutMs:15,fetchImpl:async url=>({url,status:200,body:{getReader:()=>({read:()=>oversized?Promise.resolve({done:false,value:new Uint8Array(3000001)}):new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock(){}})}})}),gap);assert.equal(cancelled,true)}})
test('actual Response requires exact final URL',async()=>{const response=new Response('<html>no redirect</html>',{status:200});Object.defineProperty(response,'url',{value:'https://unrelated.example/'});await assert.rejects(run({fetchImpl:async()=>response}),gap)})



import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const receipts=['rebrand-pages.json','lvx-employer-pages.json','zoho-pages.json','zoho-detail-pages.json','native-seed-pages.json'].flatMap(f=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+f+'.gz',import.meta.url)))))
const replay=rows=>async url=>{const r=rows.find(r=>r.url===url);assert.ok(r,'uncaptured '+url);const response=new Response(r.body,{status:r.status});Object.defineProperty(response,'url',{value:r.finalUrl});return response}
test('actual LVX rebrand and native remote roles retain unknown countries and public original dates',async()=>{const jobs=await run({fetchImpl:replay(receipts),now:'2026-10-23T09:00:00Z'});assert.equal(jobs.length,3);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs.nativeCollectionEvidence.excludedNativeCandidates.length,1);assert.ok(jobs.nativeCollectionEvidence.nativeCandidates.every(j=>j.country===null&&j.nativeDateOpenedIsPublicationDate===true));assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)})

test('changed exact identity, newly explicit job country, date/expiry schema and pagination require review',async()=>{for(const [predicate,edit]of [
 [r=>r.url.includes('/lvx-in-news/'),b=>b.replaceAll('LetsVenture rebrands as LVX','Unrelated company rebrand')],
 [r=>r.url==='https://www.linkedin.com/company/lvxventures',b=>b.replaceAll('urn:li:organization:3325282','urn:li:organization:7')],
 [r=>r.url.includes('/recruit/v2/public/'),b=>b.replaceAll('"Country":""','"Country":"India"')],
 [r=>r.url.includes('/recruit/v2/public/'),b=>b.replace('"info":{','"info":{"hasMore":true,')],
 ])await assert.rejects(run({fetchImpl:replay(receipts.map(r=>predicate(r)?{...r,body:edit(r.body)}:r))}),gap)})

test('independent search or seed drift preserves native original-date roles with explicit discovery gaps',async()=>{for(const [predicate,edit]of [
 [r=>r.url.includes('/jobs/search/'),b=>b+'<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23"}</script>'],
 [r=>r.url.includes('/jobs/view/'),b=>b.replace('</h1>','</h1><time>First published January 1,2025</time>')],
 ]){const jobs=await run({fetchImpl:replay(receipts.map(r=>predicate(r)?{...r,body:edit(r.body)}:r))});assert.equal(jobs.length,3);assert.equal(jobs.nativeCollectionEvidence.independentDiscoveryGaps.length,1);assert.equal(readInventoryEvidence(jobs).listingComplete,false)}})
test('unbounded body text fallback is not used',async()=>{let used=false;await assert.rejects(run({fetchImpl:async url=>({url,status:200,text:async()=>{used=true;return 'x'}})}),gap);assert.equal(used,false)})

test('new API date/country/expiry fields require reconciliation before incomplete observations',async()=>{for(const key of ['datePosted','Published_Time','Applicant_Countries']){const changed=receipts.map(r=>r.url.includes('/recruit/v2/public/')?{...r,body:r.body.replace('"Remote_Job":"Yes"','"'+key+'":"new native fact","Remote_Job":"Yes"')}:r);await assert.rejects(run({fetchImpl:replay(changed)}),gap)}})
test('unopened HTTP, final URL and late-abort bodies are cancelled',async()=>{for(const kind of ['status','url','abort']){let cancelled=false;const c=new AbortController(),reason={kind};const response=new Response(new ReadableStream({cancel(){cancelled=true}}),{status:kind==='status'?503:200});Object.defineProperty(response,'url',{value:kind==='url'?'https://unrelated.example/':'https://lvxventures.com/'});await assert.rejects(run({signal:c.signal,fetchImpl:async()=>{if(kind==='abort')c.abort(reason);return response}}),kind==='abort'?e=>e===reason:gap);assert.equal(cancelled,true)}})

test('compressed evidence and actual response bodies match SHA manifest',()=>{const m=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)));for(const x of m.files){const b=readFileSync(new URL('./fixtures/'+x.file,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),x.sha256);assert.equal(createHash('sha256').update(gunzipSync(b)).digest('hex'),x.uncompressedSHA256)}for(const x of m.responses){const r=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+x.file,import.meta.url)))).find(r=>r.url===x.url);assert.equal(createHash('sha256').update(r.body).digest('hex'),x.bodySHA256);assert.equal(r.finalUrl,x.finalUrl)}})
