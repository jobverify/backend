import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync,statSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createBoloformScraper,run} from './script.js'

const gap=error=>{
 assert.equal(error.code,'BOLOFORM_COVERAGE_GAP')
 assert.equal(error.sourceListingComplete,false)
 assert.equal(error.sourceScopeComplete,false)
 assert.equal(error.lifecycleCleanupAllowed,false)
 assert.equal(error.inventoryEvidence.status,'coverage-gap')
 assert.equal(error.inventoryEvidence.reportedTotal,null)
 assert.equal(error.inventoryEvidence.indiaFacetCount,null)
 return true
}
test('unreachable exact Boloform employer is an incomplete attempt, never an empty inventory',async()=>{
 const cause=new Error('controlled network failure')
 await assert.rejects(createBoloformScraper({fetchImpl:async()=>{throw cause}}).run(),error=>{
  gap(error);assert.equal(error.cause,cause);return true
 })
})
test('top-level run forwards injected transport and caller cancellation preserves the exact reason',async()=>{
 const controller=new AbortController(),reason=new Error('caller cancellation')
 const pending=run({signal:controller.signal,fetchImpl:async()=>{controller.abort(reason);throw reason}})
 await assert.rejects(pending,error=>error===reason)
})
test('preaborted caller never opens a connection',async()=>{
 const controller=new AbortController(),reason={caller:'stopped'};controller.abort(reason)
 await assert.rejects(createBoloformScraper({signal:controller.signal,fetchImpl:()=>assert.fail('fetch after abort')}).run(),error=>error===reason)
})
test('aggregate deadline bounds a transport that ignores abort',async()=>{
 await assert.rejects(createBoloformScraper({timeoutMs:15,fetchImpl:()=>new Promise(()=>{})}).run(),gap)
})
test('unreviewed successful homepage cannot establish verified empty or employer identity',async()=>{
 await assert.rejects(run({fetchImpl:async url=>({url,status:200,text:async()=>'<html><title>Boloform</title><p>No jobs found</p></html>'})}),gap)
})
test('stream size bound cancels oversized source before reading its remaining chunks',async()=>{
 let cancelled=false,read=0
 const body=new ReadableStream({pull(controller){read++;controller.enqueue(new Uint8Array(2100000))},cancel(){cancelled=true}})
 await assert.rejects(run({fetchImpl:async url=>({url,status:200,body})}),gap)
 assert.equal(cancelled,true);assert.ok(read<=3)
})
test('HTTP failure cancels unread body without parsing it',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async url=>({url,status:503,body:{cancel(){cancelled=true}},text:()=>assert.fail('read rejected body')})}),gap)
 assert.equal(cancelled,true)
})
test('redirect drift cancels unread body without accepting a similarly named employer',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async()=>({url:'https://www.boloforms.com/',status:200,body:{cancel(){cancelled=true}}})}),gap)
 assert.equal(cancelled,true)
})
test('body deadline cancels a stalled native stream',async()=>{
 let cancelled=false
 const body=new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}})
 await assert.rejects(run({timeoutMs:15,fetchImpl:async url=>({url,status:200,body})}),gap)
 assert.equal(cancelled,true)
})
test('actual configured-domain receipts are Wix HTTP404 gaps, without false employer or vacancy facts',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 for(const file of manifest.files){
  const compressed=readFileSync(new URL('./fixtures/'+file.file,import.meta.url)),raw=gunzipSync(compressed)
  assert.equal(createHash('sha256').update(compressed).digest('hex'),file.sha256)
  assert.equal(createHash('sha256').update(raw).digest('hex'),file.uncompressedSHA256)
 }
 assert.equal(manifest.responses.length,2)
 for(const receipt of manifest.responses){
  const rows=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/'+receipt.file,import.meta.url))))
  const row=rows.find(value=>value.url===receipt.url)
  assert.equal(row.status,404);assert.equal(row.finalUrl,row.url)
  assert.match(row.body,/ConnectYourDomain Error \| Wix\.com/)
  assert.equal(createHash('sha256').update(row.body).digest('hex'),receipt.bodySHA256)
 }
 const row=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/official-pages.json.gz',import.meta.url))))[0]
 await assert.rejects(run({fetchImpl:async()=>({...row,text:async()=>row.body,body:null})}),error=>{
  gap(error);assert.equal(error.status,404);assert.equal(error.inventoryEvidence.firstParty,false)
  assert.equal(error.retainedResponses[0].status,404);return true
 })
})
test('importing with unrelated dry-run arguments has no network or file effects',()=>{
 const url=new URL('./script.js',import.meta.url),jobs=new URL('./jobs.json',import.meta.url),before=statSync(jobs).mtimeMs
 const output=execFileSync(process.execPath,['--input-type=module','--eval',`process.argv=['node','unrelated','--dry-run'];globalThis.fetch=()=>{throw Error('unexpected request')};await import(${JSON.stringify(url.href)});console.log('import-only')`],{encoding:'utf8'})
 assert.equal(output.trim(),'import-only');assert.equal(statSync(jobs).mtimeMs,before)
})
