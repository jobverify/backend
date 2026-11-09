import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createClassKlapScraper} from './script.js'
const url='https://www.linkedin.com/company/classklap/'
const response=(body,status=200,finalUrl=url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createClassKlapScraper(options).run()]])test(`ClassKlap ${name} fetches native inventory and rejects a shell`,async()=>{
 let calls=0
 await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><title>ClassKlap</title><div id="root"></div></html>')}}),{code:'CLASSKLAP_COVERAGE_GAP'})
 assert.equal(calls,1)
})
test('ClassKlap bounds fetch and body deadlines',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])await assert.rejects(run({timeoutMs:15,fetchImpl}),{code:'CLASSKLAP_COVERAGE_GAP'})
})
test('ClassKlap cancels unread HTTP and final-URL failures',async()=>{
 for(const [status,finalUrl] of [[503,url],[200,'https://example.com/']]){
  let cancelled=false
  await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({cancel(){cancelled=true}}),status,finalUrl)}),{code:'CLASSKLAP_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
})
test('ClassKlap caps streamed bytes',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}}))}),{code:'CLASSKLAP_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('ClassKlap exact abort cancels late response',async()=>{
 const controller=new AbortController(),reason={stop:true};let resolve,cancelled=false
 const pending=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason);await assert.rejects(pending,e=>e===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})));await new Promise(r=>setImmediate(r));assert.equal(cancelled,true)
})
test('ClassKlap pre-abort avoids transport',async()=>{
 const signal=AbortSignal.abort({stop:true});let called=false
 await assert.rejects(run({signal,fetchImpl:async()=>{called=true}}),e=>e===signal.reason);assert.equal(called,false)
})
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const receipts=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/linkedin-pages.json.gz',import.meta.url))))
const replay=mutate=>async url=>{const row=receipts().find(r=>r.url===url);assert.ok(row,`Unexpected URL ${url}`);return response(mutate?mutate(row):row.body,row.status,row.finalUrl)}
test('ClassKlap actual native receipts establish bounded no-match observations and unknown company counts',async()=>{
 for(const execute of [options=>run(options),options=>createClassKlapScraper(options).run()]){
  const jobs=await execute({fetchImpl:replay()});assert.equal(jobs.length,0)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.firstParty,false);assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.pagesFetched,3)
  assert.equal(jobs.nativeCollectionEvidence.nativeEmployerId,'18717228');assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  assert.deepEqual(jobs.nativeCollectionEvidence.observations.map(v=>[v.location,v.observedNativeCardCount,v.explicitNoMatch]),[['India',0,true],['Worldwide',0,true]])
 }
})
test('ClassKlap native identity, filter and vacancy drift fail closed',async()=>{
 const mutations=[
  r=>r.body.replaceAll('urn:li:organization:18717228','urn:li:organization:999'),
  r=>r.body.replaceAll('http%3A%2F%2Fwww%2Eclassklap%2Ecom','http%3A%2F%2Fevil%2Ecom'),
  r=>r.body.replaceAll('checked','unchecked'),
  r=>r.url.includes('/jobs/search/')?r.body.replace('</body>','<div class="job-search-card">New role</div></body>'):r.body,
  r=>r.url.includes('/company/')?r.body.replace('</body>','<a href="https://www.linkedin.com/jobs/view/example-123">Vacancy</a></body>'):r.body,
  ...['<span itemprop="addressCountry">IN</span>','<meta name="datePosted" content="2026-10-23">','<meta property="validThrough" content="2026-11-01">','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23","jobLocation":{"address":{"addressCountry":"IN"}}}</script>','<article itemscope itemtype="https://schema.org/JobPosting"></article>','<script type="application/ld+json">{"@type":"SocialMediaPosting","datePublished":"2026-10-23T00:00:00Z"}</script>'].map(markup=>r=>r.body.replace('</body>',markup+'</body>')),
 ]
 for(const [index,mutate] of mutations.entries())await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'CLASSKLAP_COVERAGE_GAP'},`mutation ${index}`)
})
test('ClassKlap gap evidence never authorizes lifecycle cleanup',async()=>{
 await assert.rejects(run({fetchImpl:async()=>response('blocked',403)}),error=>{
  assert.equal(error.code,'CLASSKLAP_COVERAGE_GAP');assert.equal(error.partial,true);assert.equal(error.sourceListingComplete,false);assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.inventoryEvidence.reportedTotal,null);return true
 })
})
test('ClassKlap deadline cancels pending body reader',async()=>{
 let cancelled=false
 await assert.rejects(run({timeoutMs:15,fetchImpl:async()=>response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}))}),{code:'CLASSKLAP_COVERAGE_GAP'});assert.equal(cancelled,true)
})
test('ClassKlap import with unrelated dry-run has no transport or persistence side effects',async()=>{
 const {spawnSync}=await import('node:child_process')
 const result=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected fetch')};await import('./scraper/classklap/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
test('ClassKlap gzip manifest authenticates actual captured responses',()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex')
 const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 for(const file of manifest.files){const bytes=fs.readFileSync(new URL('./fixtures/'+file.file,import.meta.url));assert.equal(hash(bytes),file.sha256);assert.equal(hash(gunzipSync(bytes)),file.uncompressedSHA256)}
 for(const row of manifest.responses){const records=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+row.file,import.meta.url))));const actual=records.find(r=>r.url===row.url);assert.ok(actual);assert.equal(actual.status??null,row.status);assert.equal(actual.finalUrl??null,row.finalUrl);assert.equal(typeof actual.body==='string'?hash(actual.body):null,row.bodySHA256)}
 const parent=manifest.responses.find(r=>r.url==='https://www.eupheus.in/');assert.equal(parent.status,null);assert.equal(parent.finalUrl,null);assert.equal(parent.bodySHA256,null)
})
