import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createGiottusScraper} from '../../scraper/giottus/script.js'
const url='https://www.giottus.com/'
const response=(body,status=200,finalUrl=url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createGiottusScraper(options).run()]]){
 test(`Giottus ${name} uses injected fetch and rejects a shell`,async()=>{
  let calls=0
  await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><title>Giottus</title><div id="root"></div></html>')}}),{code:'GIOTTUS_COVERAGE_GAP'})
  assert.equal(calls,1)
 })
}
test('Giottus cancels unread responses rejected by HTTP or final URL',async()=>{
 for(const [status,finalUrl] of [[503,url],[200,'https://example.com/']]){
  let cancelled=false
  const body=new ReadableStream({cancel(){cancelled=true}})
  await assert.rejects(run({fetchImpl:async()=>response(body,status,finalUrl)}),{code:'GIOTTUS_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
})
test('Giottus caps streamed bytes and cancels the reader',async()=>{
 let cancelled=false
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}})
 await assert.rejects(run({fetchImpl:async()=>response(body)}),{code:'GIOTTUS_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('Giottus aggregate deadline includes pending fetch and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])
  await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'GIOTTUS_COVERAGE_GAP'})
})
test('Giottus preserves exact caller abort reason and cancels late response',async()=>{
 const controller=new AbortController(),reason=new Error('caller reason');let resolve,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason)
 await assert.rejects(promise,error=>error===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r))
 assert.equal(cancelled,true)
})
test('Giottus pre-abort avoids transport and preserves a non-Error reason',async()=>{
 const signal=AbortSignal.abort({reason:'stop'});let fetched=false
 await assert.rejects(run({signal,fetchImpl:async()=>{fetched=true}}),error=>error===signal.reason)
 assert.equal(fetched,false)
})
test('Giottus deadline cancels a pending body reader',async()=>{
 let cancelled=false
 await assert.rejects(run({timeoutMs:15,fetchImpl:async()=>response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}))}),{code:'GIOTTUS_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('Giottus active HTML reader prunes inherited hidden and inert templates',async()=>{
 const {activeDocument}=await import('../../scraper/giottus/native.js')
 for(const attrs of ['hidden','inert','aria-hidden="true"','style="display:none"','style="visibility:hidden"','style="content-visibility:hidden !important"']){
  const doc=activeDocument(`<div ${attrs}><a href="https://example.com/">inactive</a></div><a href="https://example.com/">active</a><template><a href="https://example.com/">template</a></template>`)
  assert.deepEqual(doc.nodes(n=>n.tag==='a').map(n=>doc.text(n)),['active'])
 }
})
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const capturedRows=['official-pages','linkedin-pages','hiring-post-pages','wellfound-pages'].flatMap(file=>JSON.parse(gunzipSync(fs.readFileSync(new URL(`../../scraper/giottus/fixtures/${file}.json.gz`,import.meta.url)))))
const replay=mutate=>async url=>{const row=capturedRows.find(r=>r.url===url);assert.ok(row,`Unexpected URL ${url}`);return response(mutate?mutate(row):row.body,row.status,row.finalUrl)}
test('Giottus replays actual employer-filtered observations without asserting company emptiness',async()=>{
 for(const execute of [options=>run(options),options=>createGiottusScraper(options).run()]){
  const jobs=await execute({fetchImpl:replay()})
  assert.equal(jobs.length,0)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.firstParty,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
  assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,5)
  assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 }
})
test('Giottus rejects changed native identity, unchecked scope, missing no-match and newly appeared jobs',async()=>{
 const mutations=[
  row=>row.body.replaceAll('urn:li:organization:13603844','urn:li:organization:123'),
  row=>row.body.replaceAll('checked','unchecked'),
  row=>row.url.includes('/jobs/search/')?row.body.replace(/<h1\b[\s\S]*?<\/h1>/g,'<h1>Something changed</h1>'):row.body,
  row=>row.url.includes('/jobs/search/')?row.body.replace('</body>','<div class="job-search-card">New opening</div></body>'):row.body,
  row=>row.url.includes('/jobs/search/')?row.body.replace('</body>','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23","validThrough":"2026-11-01","jobLocation":{"address":{"addressCountry":"IN"}}}</script></body>'):row.body,
 ]
 for(const mutate of mutations)await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'GIOTTUS_COVERAGE_GAP'})
})


test('Giottus preserves native social publication and excludes city-only location',async()=>{
 const jobs=await run({fetchImpl:replay()})
 const [fact]=jobs.nativeCollectionEvidence.excludedNativeCandidates
 assert.equal(fact.id,'7480196975502573570')
 assert.equal(fact.nativePostedDate.iso,'2026-07-07T09:52:14.278Z')
 assert.equal(fact.country,null)
 assert.equal(fact.location,'Bengaluru (Work from Office)')
 assert.equal(fact.applicationEmail,'hr@giottus.com')
 assert.equal(fact.exclusionReason,'missing-explicit-job-country')
})
test('Giottus does not ignore added social publication, expiry or country fields',async()=>{
 for(const addition of ['"datePosted":"2026-10-23",','"dateModified":"2026-10-23",','"validThrough":"2026-11-20",','"addressCountry":"IN",']){
  const mutate=row=>row.url.includes('/posts/')?row.body.replace('"@type":"SocialMediaPosting",','"@type":"SocialMediaPosting",'+addition):row.body
  await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'GIOTTUS_COVERAGE_GAP'})
 }
})
test('Giottus fails closed on unreviewed microdata or nested social country/date fields',async()=>{
 for(const markup of ['<span itemprop="addressCountry">IN</span>','<article itemscope itemtype="https://schema.org/JobPosting"></article>','<meta name="datePublished" content="2026-10-23">']){
  await assert.rejects(run({fetchImpl:replay(row=>row.url.includes('/jobs/search/')?row.body.replace('</body>',markup+'</body>'):row.body)}),{code:'GIOTTUS_COVERAGE_GAP'})
 }
 await assert.rejects(run({fetchImpl:replay(row=>row.url.includes('/posts/')?row.body.replace('"hasPart":{','"hasPart":{"validThrough":"2026-11-01",'):row.body)}),{code:'GIOTTUS_COVERAGE_GAP'})
})
