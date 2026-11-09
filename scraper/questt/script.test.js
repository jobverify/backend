import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createQuesttScraper} from './script.js'
const url='https://questt.com/'
const response=(body,status=200,finalUrl=url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createQuesttScraper(options).run()]])test(`Questt ${name} uses injected transport and fails closed on a shell`,async()=>{
 let calls=0
 await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><title>Questt</title><div id="root"></div></html>')}}),{code:'QUESTT_COVERAGE_GAP'})
 assert.equal(calls,1)
})
test('Questt rejects HTTP and redirects while cancelling unread bodies',async()=>{
 for(const [status,finalUrl] of [[503,url],[200,'https://example.com/']]){
  let cancelled=false
  await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({cancel(){cancelled=true}}),status,finalUrl)}),{code:'QUESTT_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
})
test('Questt bounds streamed bytes and cancels reader',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}}))}),{code:'QUESTT_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('Questt aggregate deadline includes fetch and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'QUESTT_COVERAGE_GAP'})
})
test('Questt exact caller abort and late response cancellation',async()=>{
 const controller=new AbortController(),reason={reason:'caller'};let resolve,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason)
 await assert.rejects(promise,e=>e===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,true)
})
test('Questt exact pre-abort has no transport',async()=>{
 const signal=AbortSignal.abort('caller');let calls=0
 await assert.rejects(run({signal,fetchImpl:async()=>{calls++}}),e=>e===signal.reason);assert.equal(calls,0)
})
test('Questt deadline cancels pending reader',async()=>{
 let cancelled=false
 await assert.rejects(run({timeoutMs:15,fetchImpl:async()=>response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}))}),{code:'QUESTT_COVERAGE_GAP'});assert.equal(cancelled,true)
})
test('Questt import with unrelated dry-run argument has no fetch or persistence side effect',async()=>{
 const {spawnSync}=await import('node:child_process')
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';fs.writeFileSync=()=>{throw Error('unexpected persistence')};syncBuiltinESMExports();process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected transport')};await import('./scraper/questt/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const files=['official-pages','ai-employer-pages']
const receipts=()=>files.flatMap(name=>{const gz=new URL(`./fixtures/${name}.json.gz`,import.meta.url);return JSON.parse(fs.existsSync(gz)?gunzipSync(fs.readFileSync(gz)):fs.readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url)))})
const replay=mutate=>async url=>{const row=receipts().find(r=>r.url===url);assert.ok(row,`Missing actual receipt ${url}`);return response(mutate?mutate(row):row.body,row.status,row.finalUrl)}
test('Questt replays actual native receipts without inventing complete emptiness',async()=>{
 const jobs=await run({fetchImpl:replay()})
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.firstParty,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.pagesFetched,4)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.deepEqual(jobs.nativeCollectionEvidence.scopeObservations.map(v=>[v.employerId,v.location,v.observedNoMatch]),[['69658946','India',true],['69658946','Worldwide',true]])
 assert.ok(jobs.nativeCollectionEvidence.retainedResponses.every(r=>r.url===r.finalUrl&&r.status===200&&r.bodySHA256===createHash('sha256').update(r.body).digest('hex')))
})
test('Questt factory preserves injected replay and run options override defaults',async()=>{
 const jobs=await createQuesttScraper({fetchImpl:()=>{throw Error('unused')}}).run({fetchImpl:replay()})
 assert.equal(readInventoryEvidence(jobs).pagesFetched,4)
})
test('Questt fails review on new role, recruiting handoff, identity, scope, JobPosting and date/country/expiry drift',async()=>{
 const mutations=[
  row=>row.body.replaceAll('urn:li:organization:69658946','urn:li:organization:1234'),
  row=>row.url.includes('location=India')?row.body.replaceAll('checked','unchecked'):row.body,
  row=>row.url.includes('location=India')?row.body.replace('</h1>','</h1><div class="job-search-card">New role</div>'):row.body,
  row=>row.url===url?row.body.replace('</body>','<a href="/careers">Careers</a></body>'):row.body,
  row=>row.body.replace('</body>','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-01","jobLocation":{"addressCountry":"IN"}}</script></body>'),
  row=>row.body.replace('</body>','<span itemprop="validThrough">2026-11-01</span></body>'),
  row=>row.body.replace('</body>','<span itemprop="addressCountry">IN</span></body>'),
  row=>row.body.replace('</body>','<meta name="datePosted" content="2026-10-01"></body>'),
  row=>row.url.includes('/company/')?row.body.replace('</body>','<a href="https://www.linkedin.com/jobs/view/new-role-1234">New role</a></body>'):row.body,
 ]
 for(const mutate of mutations)await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'QUESTT_COVERAGE_GAP'})
})
test('Questt rejects response without bounded stream and cancels unread body',async()=>{
 let cancelled=false,textRead=false
 await assert.rejects(run({fetchImpl:async()=>({url,status:200,body:{cancel(){cancelled=true}},text(){textRead=true;return 'unbounded'}})}),{code:'QUESTT_COVERAGE_GAP'})
 assert.equal(cancelled,true);assert.equal(textRead,false)
})
test('Questt capture manifest verifies gzip and uncompressed response hashes and true final URLs',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 for(const entry of manifest.files){
  const zipped=fs.readFileSync(new URL('./fixtures/'+entry.file,import.meta.url)),raw=gunzipSync(zipped)
  assert.equal(createHash('sha256').update(zipped).digest('hex'),entry.sha256)
  assert.equal(createHash('sha256').update(raw).digest('hex'),entry.uncompressedSHA256)
 }
 for(const row of manifest.responses){
  const record=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+row.captureFile,import.meta.url)))).find(v=>v.url===row.url)
  assert.equal(record.finalUrl??null,row.finalUrl);assert.equal(record.status??null,row.status)
  if(typeof record.body==='string')assert.equal(createHash('sha256').update(record.body).digest('hex'),row.bodySHA256)
  else {assert.equal(row.status,null);assert.equal(row.bodySHA256,null)}
 }
})
test('Questt rejects changed corporate country and new structured country outside reviewed organization address',async()=>{
 const mutations=[
  row=>row.url.includes('/company/')?row.body.replace('"addressCountry":"IN"','"addressCountry":"US"'):row.body,
  row=>row.url===url?row.body.replace('</body>','<script type="application/ld+json">{"@type":"Thing","country":"India"}</script></body>'):row.body,
  row=>row.url===url?row.body.replace('</body>','<script type="application/ld+json">{"@type":"Place","addressCountry":"IN"}</script></body>'):row.body,
  row=>row.url.includes('/company/')?row.body.replace('</body>','<script type="application/ld+json">{"@type":"Place","addressCountry":"IN"}</script></body>'):row.body,
 ]
 for(const mutate of mutations)await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'QUESTT_COVERAGE_GAP'})
})

