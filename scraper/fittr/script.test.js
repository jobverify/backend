import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createFittrScraper} from './script.js'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const url='https://www.fittr.com/'
const response=(body,status=200,finalUrl=url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createFittrScraper(options).run()]]){
 test(`Fittr ${name} uses injected fetch and rejects a shell`,async()=>{
  let calls=0
  await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><title>Fittr</title><div id="root"></div></html>')}}),{code:'FITTR_COVERAGE_GAP'})
  assert.equal(calls,1)
 })
}
test('Fittr cancels unread responses rejected by HTTP or final URL',async()=>{
 for(const [status,finalUrl] of [[503,url],[200,'https://example.com/']]){
  let cancelled=false
  const body=new ReadableStream({cancel(){cancelled=true}})
  await assert.rejects(run({fetchImpl:async()=>response(body,status,finalUrl)}),{code:'FITTR_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
})
test('Fittr caps streamed bytes and cancels the reader',async()=>{
 let cancelled=false
 const body=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}})
 await assert.rejects(run({fetchImpl:async()=>response(body)}),{code:'FITTR_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('Fittr aggregate deadline includes pending fetch and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])
  await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'FITTR_COVERAGE_GAP'})
})
test('Fittr preserves exact caller abort reason and cancels late response',async()=>{
 const controller=new AbortController(),reason=new Error('caller reason');let resolve,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason)
 await assert.rejects(promise,error=>error===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r))
 assert.equal(cancelled,true)
})
test('Fittr pre-abort avoids transport and preserves a non-Error reason',async()=>{
 const signal=AbortSignal.abort({reason:'stop'});let fetched=false
 await assert.rejects(run({signal,fetchImpl:async()=>{fetched=true}}),error=>error===signal.reason)
 assert.equal(fetched,false)
})
test('Fittr deadline cancels a pending body reader',async()=>{
 let cancelled=false
 await assert.rejects(run({timeoutMs:15,fetchImpl:async()=>response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}))}),{code:'FITTR_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})

const rows=['official-pages','linkedin-pages'].flatMap(file=>{
 const base=new URL(`./fixtures/${file}.json`,import.meta.url)
 return JSON.parse(fs.existsSync(new URL(base.href+'.gz'))?gunzipSync(fs.readFileSync(new URL(base.href+'.gz'))):fs.readFileSync(base))
})
const replay=mutate=>async url=>{const row=rows.find(r=>r.url===url);assert.ok(row,`Unexpected native URL ${url}`);return response(mutate?mutate(row):row.body,row.status,row.finalUrl)}
test('Fittr actual receipts retain excluded employer vacancies and unknown company inventory',async()=>{
 for(const execute of [options=>run(options),options=>createFittrScraper(options).run()]){
  const jobs=await execute({fetchImpl:replay()});assert.equal(jobs.length,0)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.firstParty,false)
  assert.equal(jobs.nativeCollectionEvidence.retainedResponses.length,7);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  const candidates=jobs.nativeCollectionEvidence.excludedNativeCandidates
  assert.deepEqual(candidates.map(c=>c.nativePostedDate.iso),['2026-01-07T12:43:43.444Z','2026-04-27T07:35:08.162Z'])
  assert.deepEqual(candidates.map(c=>c.location),['Pune (Work from Office)',null])
  assert.ok(candidates.every(c=>c.country===null&&c.exclusionReason==='missing-explicit-job-country'&&c.activeApplyVerified===false))
 }
})
test('Fittr rejects native employer, country, publication, expiry, role and scope drift',async()=>{
 const mutations=[
  row=>row.body.replaceAll('urn:li:organization:2970058','urn:li:organization:999'),
  row=>row.body.replaceAll('checked','unchecked'),
  row=>row.url.includes('/jobs/search/')?row.body.replace('</body>','<div class="job-search-card">Opening</div></body>'):row.body,
  row=>row.url.includes('/posts/')?row.body.replace('2026-01-07T12:43:43.444Z','2026-10-23T00:00:00.000Z'):row.body,
  row=>row.url.includes('/posts/')?row.body.replaceAll('Pune (Work from Office)','Pune, India'):row.body,
  ...['<span itemprop="addressCountry">IN</span>','<meta name="dateModified" content="2026-10-23">','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23"}</script>','<article itemscope itemtype="https://schema.org/JobPosting"></article>'].map(markup=>row=>row.body.replace('</body>',markup+'</body>')),
  ...['"validThrough":"2026-11-01",','"datePosted":"2026-10-23",','"jobLocation":{"address":{"addressCountry":"IN"}},'].map(field=>row=>row.url.includes('/posts/')?row.body.replace('"@type":"SocialMediaPosting",','"@type":"SocialMediaPosting",'+field):row.body),
 ]
 for(const [index,mutate] of mutations.entries())await assert.rejects(run({fetchImpl:replay(mutate)}),{code:'FITTR_COVERAGE_GAP'},`mutation ${index}`)
})
test('Fittr import with unrelated dry-run argument has no transport or persistence side effect',async()=>{
 const {spawnSync}=await import('node:child_process')
 const result=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected transport')};await import('./scraper/fittr/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
test('Fittr fixture manifest verifies compressed receipts and their actual response bodies',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 const hash=value=>createHash('sha256').update(value).digest('hex')
 for(const file of manifest.files){const bytes=fs.readFileSync(new URL('./fixtures/'+file.file,import.meta.url));assert.equal(hash(bytes),file.sha256);assert.equal(hash(gunzipSync(bytes)),file.uncompressedSHA256)}
 for(const row of manifest.responses){const records=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+row.file,import.meta.url))));const actual=records.find(r=>r.url===row.url);assert.ok(actual);assert.equal(actual.status??null,row.status);assert.equal(actual.finalUrl??null,row.finalUrl);assert.equal(typeof actual.body==='string'?hash(actual.body):null,row.bodySHA256)}
})

