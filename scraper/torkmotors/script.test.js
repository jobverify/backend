import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createTorkMotorsScraper,run} from './script.js'

const url='https://torkmotors.com/'
const response=(body='<h1>Cà Khịa TV</h1>')=>{const r=new Response(body);Object.defineProperty(r,'url',{value:url});return r}
const gap=e=>e.code==='TORKMOTORS_COVERAGE_GAP'&&e.inventoryEvidence.reportedTotal===null&&e.inventoryEvidence.indiaFacetCount===null&&e.lifecycleCleanupAllowed===false
test('unrelated historical employer domain is a typed gap, never empty inventory',async()=>{
 await assert.rejects(run({fetchImpl:async()=>response()}),e=>gap(e)&&e.retainedResponses.length===1)
})
test('factory and run inject transport and retain source identity limits',async()=>{
 await assert.rejects(createTorkMotorsScraper({fetchImpl:async()=>response('<h1>Tork Motors</h1>')}).run(),gap)
})
test('transport failure cannot silently clear jobs',async()=>{
 await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),gap)
})
test('caller abort preserves the exact reason',async()=>{
 const c=new AbortController(),reason={why:'caller'};c.abort(reason)
 await assert.rejects(run({signal:c.signal,fetchImpl:async()=>response()}),e=>e===reason)
})
test('in-flight caller abort preserves reason and cancels a stalled body',async()=>{
 const c=new AbortController(),reason={why:'during body'};let cancelled=false,started
 const ready=new Promise(resolve=>{started=resolve})
 const r=new Response(new ReadableStream({pull(){started();return new Promise(()=>{})},cancel(){cancelled=true}}));Object.defineProperty(r,'url',{value:url})
 const pending=run({signal:c.signal,fetchImpl:async()=>r})
 await ready;c.abort(reason)
 await assert.rejects(pending,e=>e===reason);assert.equal(cancelled,true)
})
test('fetch deadline also cancels a response arriving after the caller stopped waiting',async()=>{
 let finish,cancelled=false
 const pending=run({timeoutMs:20,fetchImpl:()=>new Promise(resolve=>{finish=resolve})})
 await assert.rejects(pending,gap)
 finish({url,status:200,body:{cancel(){cancelled=true}}})
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancelled,true)
})
test('deadline includes stalled body and cancels its reader',async()=>{
 let cancelled=false
 const r=new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled=true}}));Object.defineProperty(r,'url',{value:url})
 await assert.rejects(run({timeoutMs:20,fetchImpl:async()=>r}),gap)
 assert.equal(cancelled,true)
})
test('no unbounded text fallback and unread HTTP body is cancelled',async()=>{
 let textCalled=false,cancelled=false
 await assert.rejects(run({fetchImpl:async()=>({status:200,url,body:{cancel(){cancelled=true}},text(){textCalled=true}})}),gap)
 assert.equal(textCalled,false);assert.equal(cancelled,true)
 cancelled=false
 await assert.rejects(run({fetchImpl:async()=>({status:503,url,body:{cancel(){cancelled=true}}})}),gap)
 assert.equal(cancelled,true)
})
test('oversized streamed bodies and changed final URLs fail closed',async()=>{
 await assert.rejects(run({fetchImpl:async()=>response('x'.repeat(4000001))}),gap)
 const r=new Response('unrelated');Object.defineProperty(r,'url',{value:'https://other.example/'})
 await assert.rejects(run({fetchImpl:async()=>r}),gap)
})
test('actual captured domain response replays with its true final URL and digest',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('./fixtures/capture-manifest.json',import.meta.url)))
 const entry=manifest.files.find(f=>f.file==='official-pages.json.gz')
 const gzip=readFileSync(new URL('./fixtures/'+entry.file,import.meta.url))
 assert.equal(createHash('sha256').update(gzip).digest('hex'),entry.sha256)
 const body=gunzipSync(gzip)
 assert.equal(createHash('sha256').update(body).digest('hex'),entry.uncompressedSHA256)
 const native=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/linkedin-pages.json.gz',import.meta.url))))
 const rows=[...JSON.parse(body),...native],row=rows.find(r=>r.url===url&&r.status===200)
 assert.ok(row);assert.equal(row.finalUrl,url)
 await assert.rejects(run({fetchImpl:async requested=>{const receipt=rows.find(r=>r.url===requested&&r.status===200);assert.ok(receipt);const r=new Response(receipt.body,{status:receipt.status});Object.defineProperty(r,'url',{value:receipt.finalUrl});return r}}),e=>gap(e)&&e.retainedResponses.length===4&&e.retainedResponses[0].body===row.body&&/unrelated Vietnamese football/.test(e.message))
})
