import test from 'node:test'
import assert from 'node:assert/strict'
import {createFarmTheoryScraper,run} from './script.js'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'

const receiptMap=()=>{
 const dir=new URL('./fixtures/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('capture-manifest.json',dir)))
 const records=[]
 for(const entry of manifest){const gz=readFileSync(new URL(entry.path,dir));assert.equal(createHash('sha256').update(gz).digest('hex'),entry.sha256);records.push(...JSON.parse(gunzipSync(gz)))}
 return new Map(records.map(r=>[r.url,r]))
}
test('actual captured corporate and employer searches do not establish empty inventory',async()=>{
 const receipts=receiptMap(),seen=[]
 await assert.rejects(run({fetchImpl:async url=>{
  seen.push(url);const r=receipts.get(url);assert.ok(r?.body)
  return {url:r.finalUrl,status:r.status,body:new Response(r.body).body}
 }}),e=>e.code==='FARMTHEORY_COVERAGE_GAP'&&e.retainedResponses.length===4&&e.cause.message.includes('Whole-company inventory unknown'))
 assert.equal(seen.length,4)
})
test('body deadline cancels a stalled reader',async()=>{
 let cancelled=false
 const body=new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}})
 await assert.rejects(run({timeoutMs:15,fetchImpl:async url=>({url,status:200,body})}),e=>e.code==='FARMTHEORY_COVERAGE_GAP')
 assert.equal(cancelled,true)
})
test('new native vacancy cards fail review instead of preserving no-match observation',async()=>{
 const receipts=receiptMap()
 await assert.rejects(run({fetchImpl:async url=>{
  const r=receipts.get(url),body=r.body+(url.includes('location=India')?'<div class="job-search-card">New role</div>':'')
  return {url:r.finalUrl,status:r.status,body:new Response(body).body}
 }}),e=>e.code==='FARMTHEORY_COVERAGE_GAP'&&e.cause.message.includes('Native vacancy listing changed'))
})
test('import with dry-run flag does not trigger transport or persistence',()=>{
 const code="process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('import transport')};await import('./scraper/farmtheory/script.js')"
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
test('reject nonstream fallback without reading text and cancel unread HTTP failure',async()=>{
 let cancelled=0
 for(const status of [200,503])await assert.rejects(run({fetchImpl:async url=>({url,status,body:{cancel(){cancelled++}},text(){assert.fail('unbounded fallback')}})}),e=>e.code==='FARMTHEORY_COVERAGE_GAP')
 assert.equal(cancelled,2)
})

test('transport failure is unknown inventory rather than static empty',async()=>{
 let calls=0
 await assert.rejects(run({fetchImpl:async()=>{calls++;throw Error('offline')}}),e=>e.code==='FARMTHEORY_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null&&!e.lifecycleCleanupAllowed)
 assert.equal(calls,1)
})
test('factory forwards transport and preserves exact caller abort',async()=>{
 const controller=new AbortController(),reason=new Error('caller')
 const promise=createFarmTheoryScraper({fetchImpl:async()=>new Promise(()=>{}),signal:controller.signal}).run()
 controller.abort(reason)
 await assert.rejects(promise,e=>e===reason)
})
test('aggregate deadline bounds ignored transport abort',async()=>{
 await assert.rejects(run({fetchImpl:async()=>new Promise(()=>{}),timeoutMs:15}),e=>e.code==='FARMTHEORY_COVERAGE_GAP')
})
