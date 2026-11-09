import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createLidoLearningScraper} from './script.js'
const home='https://www.lidolearning.com/'
const response=(body,status=200,url=home)=>{const r=new Response(body,{status});Object.defineProperty(r,'url',{value:url});return r}
for(const [name,execute] of [['run',run],['factory',o=>createLidoLearningScraper(o).run()]])test(`Lido ${name} checks native transport instead of unconditional empty`,async()=>{
 let calls=0
 await assert.rejects(execute({fetchImpl:async()=>{calls++;return response('<html><h1>unrelated domain</h1></html>')}}),{code:'LIDOLEARNING_COVERAGE_GAP'})
 assert.equal(calls,1)
})
test('Lido preserves exact caller abort and avoids pre-aborted transport',async()=>{
 const reason={stop:true};let calls=0
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchImpl:()=>{calls++}}),e=>e===reason)
 assert.equal(calls,0)
})
test('Lido aggregate deadline bounds pending fetch and pending body',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>response(new ReadableStream({pull(){return new Promise(()=>{})}}))])await assert.rejects(run({fetchImpl,timeoutMs:15}),{code:'LIDOLEARNING_COVERAGE_GAP'})
})
test('Lido cancels HTTP failure, unexpected redirect and absent bounded stream',async()=>{
 for(const [status,url] of [[503,home],[200,'https://example.com/']]){
  let cancelled=false
  await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({cancel(){cancelled=true}}),status,url)}),{code:'LIDOLEARNING_COVERAGE_GAP'})
  assert.equal(cancelled,true)
 }
 await assert.rejects(run({fetchImpl:async()=>({url:home,status:200,text(){throw Error('unbounded text forbidden')}})}),{code:'LIDOLEARNING_COVERAGE_GAP'})
})

test('Lido cancels excessive streamed bodies',async()=>{
 let cancelled=false
 await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(1000001))},cancel(){cancelled=true}}))}),{code:'LIDOLEARNING_COVERAGE_GAP'})
 assert.equal(cancelled,true)
})
test('Lido caller abort cancels body and preserves exact reason',async()=>{
 const controller=new AbortController(),reason=new Error('exact caller');let cancelled=false,started
 const ready=new Promise(r=>{started=r})
 const pending=run({signal:controller.signal,fetchImpl:async()=>response(new ReadableStream({pull(){started();return new Promise(()=>{})},cancel(){cancelled=true}}))})
 await ready;controller.abort(reason)
 await assert.rejects(pending,e=>e===reason);assert.equal(cancelled,true)
})
test('Lido cancels unread late fetch after caller abort',async()=>{
 const controller=new AbortController(),reason={stop:'now'};let resolve,cancelled=false
 const pending=run({signal:controller.signal,fetchImpl:()=>new Promise(r=>{resolve=r})})
 controller.abort(reason);await assert.rejects(pending,e=>e===reason)
 resolve(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(r=>setImmediate(r));assert.equal(cancelled,true)
})
test('Lido import with unrelated dry-run flag has no persistence or transport',async()=>{
 const {spawnSync}=await import('node:child_process')
 const result=spawnSync(process.execPath,['--input-type=module','-e',`process.argv.push('--dry-run');globalThis.fetch=()=>{throw Error('unexpected fetch')};await import('./scraper/lidolearning/script.js')`],{cwd:new URL('../../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
