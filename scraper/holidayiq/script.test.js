import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,createHolidayIQScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const rows=['official-pages','linkedin-pages'].flatMap(name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name+'.json.gz',import.meta.url)))))
const response=(body,status=200,url='https://www.holidayiq.com/')=>{const result=new Response(body,{status});Object.defineProperty(result,'url',{value:url});return result}
export const replay=async url=>{const row=rows.find(row=>row.url===url);assert.ok(row,'Unexpected URL '+url);return response(row.body,row.status,row.finalUrl)}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createHolidayIQScraper(options).run()]])test('HolidayIQ '+name+' reports actual blocked receipt as unknown inventory',async()=>{
 await assert.rejects(execute({fetchImpl:replay}),error=>{
  assert.equal(error.code,'HOLIDAYIQ_COVERAGE_GAP');assert.equal(error.nativeCollectionEvidence.nativeEmployerId,'404342');assert.equal(error.retainedResponses.length,4);assert.equal(error.retainedResponses[0].status,403)
  assert.equal(error.lifecycleCleanupAllowed,false);assert.equal(error.sourceListingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.equal(error.retainedResponses[0].body,rows[0].body);return true
 })
})
test('HolidayIQ transport failure cannot become empty inventory',async()=>{
 await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),{code:'HOLIDAYIQ_COVERAGE_GAP'})
})

test('HolidayIQ aggregate deadline covers pending transport and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'HOLIDAYIQ_COVERAGE_GAP'})
})
test('HolidayIQ preserves exact caller cancellation and cancels late response',async()=>{
 const controller=new AbortController(),reason={stop:'caller'};let resolve,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})});controller.abort(reason)
 await assert.rejects(promise,error=>error===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,true)
 let fetched=false
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchImpl:async()=>{fetched=true}}),error=>error===reason);assert.equal(fetched,false)
})
test('HolidayIQ rejects unsupported stream without unbounded text fallback',async()=>{
 let cancelled=false,textCalled=false
 await assert.rejects(run({fetchImpl:async()=>({url:'https://www.holidayiq.com/',status:200,body:{cancel(){cancelled=true}},text(){textCalled=true;return 'hello'}})}),{code:'HOLIDAYIQ_COVERAGE_GAP'})
 assert.equal(textCalled,false);assert.equal(cancelled,true)
})
test('HolidayIQ cancels oversized, redirected and timed out streams',async()=>{
 for(const variant of ['large','redirect','timeout']){
  let cancelled=false
  const body=new ReadableStream({pull(c){if(variant==='large')c.enqueue(new Uint8Array(1000001));else return new Promise(()=>{})},cancel(){cancelled=true}})
  await assert.rejects(run({fetchImpl:async()=>response(body,200,variant==='redirect'?'https://example.com/':'https://www.holidayiq.com/'),timeoutMs:20}),{code:'HOLIDAYIQ_COVERAGE_GAP'})
  assert.equal(cancelled,true,variant)
 }
})
test('HolidayIQ rejects employer/scope/role/date/country/expiry drift before no-match conclusion',async()=>{
 const mutations=[
  row=>row.body.replaceAll('urn:li:organization:404342','urn:li:organization:999'),
  row=>row.body.replaceAll('checked','unchecked'),
  row=>row.body.replaceAll('find a match','list vacancies'),
  ...['<time>2026-10-23</time>','<time datetime="2020-01-01">Old</time>','<div class="job-search-card">Role</div>','<span itemprop="addressCountry">IN</span>','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-23"}</script>','<meta name="validThrough" content="2026-10-01">'].map(markup=>row=>row.body.replace('</body>',markup+'</body>')),
 ]
 for(const [index,mutate] of mutations.entries())await assert.rejects(run({fetchImpl:async url=>{const row=rows.find(r=>r.url===url);return response(mutate(row),row.status,row.finalUrl)}}),error=>{assert.equal(error.code,'HOLIDAYIQ_COVERAGE_GAP');assert.ok(!error.nativeCollectionEvidence,'drift '+index);return true})
})
test('HolidayIQ unrelated dry-run import has no transport or persistence side effects',async()=>{
 const {spawnSync}=await import('node:child_process')
 const result=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected transport')};await import('./scraper/holidayiq/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})

test('HolidayIQ compressed actual receipts match manifest file and body hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 const hash=v=>createHash('sha256').update(v).digest('hex')
 for(const file of manifest.files){const bytes=fs.readFileSync(new URL('./fixtures/'+file.file,import.meta.url));assert.equal(hash(bytes),file.sha256);assert.equal(hash(gunzipSync(bytes)),file.uncompressedSHA256)}
 for(const row of manifest.responses){const records=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+row.file,import.meta.url))));const actual=records.find(r=>r.url===row.url);assert.ok(actual);assert.equal(actual.status??null,row.status);assert.equal(actual.finalUrl??null,row.finalUrl);assert.equal(typeof actual.body==='string'?hash(actual.body):null,row.bodySHA256)}
})
