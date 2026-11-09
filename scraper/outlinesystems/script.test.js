import test from 'node:test'
import assert from 'node:assert/strict'
import {run,createOutlineSystemsScraper} from './script.js'
const gap=e=>{assert.equal(e.code,'OUTLINESYSTEMS_COVERAGE_GAP');assert.equal(e.lifecycleCleanupAllowed,false);assert.equal(e.inventoryEvidence.reportedTotal,null);return true}
test('offline source is evidence-bearing coverage gap',async()=>{await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)})
test('factory aliases retain dependency injection',async()=>{for(const factory of [createOutlineSystemsScraper])await assert.rejects(factory({fetchImpl:async()=>{throw Error('offline')}}).run(),gap)})
test('aggregate source deadline includes fetch and body',async()=>{for(const fetchImpl of [()=>new Promise(()=>{}),async url=>({url,status:200,body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{},releaseLock(){}})}})])await assert.rejects(run({fetchImpl,timeoutMs:10}),gap)})
test('exact caller abort reason survives before, fetch and body cancellation',async()=>{for(const stage of ['before','fetch','body']){const c=new AbortController(),reason={stage};if(stage==='before')c.abort(reason);await assert.rejects(run({signal:c.signal,fetchImpl:async url=>{if(stage==='fetch'){c.abort(reason);return new Promise(()=>{})}return {url,status:200,body:{getReader:()=>({read:()=>{c.abort(reason);return new Promise(()=>{})},cancel:async()=>{},releaseLock(){}})}}}}),e=>e===reason)}})
test('bounded streamed bodies are cancelled at cap and deadline',async()=>{for(const oversized of [true,false]){let cancelled=false;await assert.rejects(run({timeoutMs:15,fetchImpl:async url=>({url,status:200,body:{getReader:()=>({read:()=>oversized?Promise.resolve({done:false,value:new Uint8Array(3000001)}):new Promise(()=>{}),cancel:async()=>{cancelled=true},releaseLock(){}})}})}),gap);assert.equal(cancelled,true)}})
test('actual Response requires exact final URL',async()=>{const response=new Response('<html>no redirect</html>',{status:200});Object.defineProperty(response,'url',{value:'https://unrelated.example/'});await assert.rejects(run({fetchImpl:async()=>response}),gap)})


import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const receipts=['linkedin-pages.json','successor-pages.json','successor-search-pages.json','successor-detail-pages.json'].flatMap(f=>JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+f+'.gz',import.meta.url)))))
const replay=rows=>async(url,init={})=>{const r=rows.find(r=>r.url===url&&(!r.requestBody||JSON.stringify(r.requestBody)===init.body));assert.ok(r,'uncaptured '+url);const response=new Response(r.body,{status:r.status});Object.defineProperty(response,'url',{value:r.finalUrl});return response}
test('actual legacy searches and successor candidate details preserve unresolved former-entity scope',async()=>{const jobs=await run({fetchImpl:replay(receipts),now:'2026-10-23T09:00:00Z'});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs.nativeCollectionEvidence.successorCandidates.length,14);assert.ok(jobs.nativeCollectionEvidence.successorCandidates.some(r=>r.additionalLocations?.includes('Bengaluru, India')));assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)})

test('unsupported unbounded body reader is rejected before text buffering',async()=>{let called=false;await assert.rejects(run({fetchImpl:async url=>({url,status:200,text:async()=>{called=true;return 'x'}})}),gap);assert.equal(called,false)})

test('new successor exact-scope bindings, invalid dates and incomplete keyword inventories require review',async()=>{for(const mutate of [
 r=>r.url.includes('/wday/cxs/')&&r.url.includes('/job/')?{...r,body:r.body.replace('Helping careers take flight.','Outline Systems ProducerOne')}:r,
 r=>r.url.includes('/wday/cxs/')&&r.url.includes('/job/')?{...r,body:r.body.replace(/"startDate":"[^"]+"/,'"startDate":"2099-01-01"')}:r,
 r=>r.requestBody?.searchText==='Outline'?{...r,body:r.body.replace('"total":14','"total":21')}:r,
 ])await assert.rejects(run({fetchImpl:replay(receipts.map(mutate))}),gap)})
test('compressed receipts, POST request bodies and actual body hashes verify',()=>{const m=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)));for(const x of m.files){const b=readFileSync(new URL('./fixtures/'+x.file,import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),x.sha256);assert.equal(createHash('sha256').update(gunzipSync(b)).digest('hex'),x.uncompressedSHA256)}for(const x of m.responses){const r=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+x.file,import.meta.url)))).find(r=>r.url===x.url&&JSON.stringify(r.requestBody??null)===JSON.stringify(x.requestBody));assert.equal(createHash('sha256').update(r.body).digest('hex'),x.bodySHA256);assert.equal(r.finalUrl,x.finalUrl)}})
