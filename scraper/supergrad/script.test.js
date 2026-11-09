import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createSupergradScraper} from './script.js'
const url='https://www.supergrad.co.in/'
const response=(body,status=200,finalUrl=url)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r}
for(const [name,execute] of [['run',options=>run(options)],['factory',options=>createSupergradScraper(options).run()]])test(`Supergrad ${name} uses injected transport and fails closed on a shell`,async()=>{
 let calls=0
 await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><title>Supergrad</title><div id="root"></div></html>')}}),{code:'SUPERGRAD_COVERAGE_GAP'})
 assert.equal(calls,1)
})
test('Supergrad rejects HTTP and redirects while cancelling unread bodies',async()=>{
 for(const [status,finalUrl] of [[503,url],[200,'https://example.com/']]){
  let cancelled=false
  await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({cancel(){cancelled=true}}),status,finalUrl)}),{code:'SUPERGRAD_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
})
test('Supergrad bounds streamed bytes and cancels reader',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}}))}),{code:'SUPERGRAD_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('Supergrad aggregate deadline includes fetch and body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'SUPERGRAD_COVERAGE_GAP'})
})
test('Supergrad exact caller abort and late response cancellation',async()=>{
 const controller=new AbortController(),reason={reason:'caller'};let resolve,cancelled=false
 const promise=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason)
 await assert.rejects(promise,e=>e===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,true)
})
test('Supergrad exact pre-abort has no transport',async()=>{
 const signal=AbortSignal.abort('caller');let calls=0
 await assert.rejects(run({signal,fetchImpl:async()=>{calls++}}),e=>e===signal.reason);assert.equal(calls,0)
})
test('Supergrad deadline cancels pending reader',async()=>{
 let cancelled=false
 await assert.rejects(run({timeoutMs:15,fetchImpl:async()=>response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}))}),{code:'SUPERGRAD_COVERAGE_GAP'});assert.equal(cancelled,true)
})
test('Supergrad import with unrelated dry-run argument has no fetch or persistence side effect',async()=>{
 const {spawnSync}=await import('node:child_process')
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';fs.writeFileSync=()=>{throw Error('unexpected persistence')};syncBuiltinESMExports();process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected transport')};await import('./scraper/supergrad/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
test('Supergrad replays actual captured transport failure without fabricated HTTP or inventory',async()=>{
 const rows=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/official-pages.json.gz',import.meta.url))))
 let request
 await assert.rejects(run({fetchImpl:async url=>{request=url;throw Error(rows[0].error)}}),error=>{
  assert.equal(error.code,'SUPERGRAD_COVERAGE_GAP')
  assert.equal(error.inventoryEvidence.status,'coverage-gap')
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.equal(error.inventoryEvidence.pagesFetched,0)
  assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
  assert.deepEqual(error.retainedResponses,[])
  assert.equal(error.cause.message,rows[0].error)
  return true
 })
 assert.equal(request,rows[0].url)
 assert.ok(manifest.attempts.every(v=>v.status===null&&v.finalUrl===null&&v.bodySHA256===null))
})
const home='<html><body><h1>Supergrad</h1><p>We are a professional certification and training organisation.</p><a href="mailto:contact@supergrad.co.in">Contact</a><p>Apply for Batch 2026. Careers and job-ready placement.</p></body></html>'
test('Supergrad synthetic readable training page cannot masquerade as vacancy inventory',async()=>{
 await assert.rejects(run({fetchImpl:async()=>response(home)}),e=>e.code==='SUPERGRAD_COVERAGE_GAP'&&e.retainedResponses.length===1&&e.inventoryEvidence.reportedTotal===null&&/admissions, course projects/.test(e.cause.message))
})
test('Supergrad new recruiting handoff remains a typed review gap with observed links',async()=>{
 await assert.rejects(run({fetchImpl:async()=>response(home.replace('</body>','<a href="/careers">Work with us</a></body>'))}),e=>e.code==='SUPERGRAD_COVERAGE_GAP'&&e.discoveredRecruitingLinks?.[0]?.href==='/careers')
})
test('Supergrad rejects identity drift, challenges and new schema/microdata',async()=>{
 for(const body of [home.replaceAll('Supergrad','TopRankers Supergrads').replaceAll('contact@supergrad.co.in','contact@supergrads.com'),'<html><body>Cloudflare connection timed out Error code 522</body></html>',home.replace('</body>','<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-01"}</script></body>'),home.replace('</body>','<span itemprop="addressCountry">IN</span></body>'),home.replace('</body>','<span itemprop="validThrough">2026-11-01</span></body>')])await assert.rejects(run({fetchImpl:async()=>response(body)}),{code:'SUPERGRAD_COVERAGE_GAP'})
})
test('Supergrad rejects unavailable bounded stream without invoking text fallback',async()=>{
 let cancelled=false,textRead=false
 await assert.rejects(run({fetchImpl:async()=>({url,status:200,body:{cancel(){cancelled=true}},text(){textRead=true;return home}})}),{code:'SUPERGRAD_COVERAGE_GAP'})
 assert.equal(cancelled,true);assert.equal(textRead,false)
})
test('Supergrad verifies preserved compressed captures and raw hashes',()=>{
 for(const entry of manifest.files){
  const zipped=fs.readFileSync(new URL('./fixtures/'+entry.file,import.meta.url)),raw=gunzipSync(zipped)
  assert.equal(createHash('sha256').update(zipped).digest('hex'),entry.sha256)
  assert.equal(createHash('sha256').update(raw).digest('hex'),entry.uncompressedSHA256)
 }
})
test('Supergrad requires review for newly supplied structured country evidence',async()=>{
 for(const field of ['country','addressCountry'])await assert.rejects(run({fetchImpl:async()=>response(home.replace('</body>',`<script type="application/ld+json">{"@type":"Place","${field}":"IN"}</script></body>`))}),e=>e.code==='SUPERGRAD_COVERAGE_GAP'&&/New structured role country/.test(e.cause?.message))
})

