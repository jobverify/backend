import assert from 'node:assert/strict'
import test from 'node:test'
import {run,FIRST_PARTY_CAREERS_URL} from './script.js'

const response=(body,status=200,url=FIRST_PARTY_CAREERS_URL)=>{
 const r=new Response(body,{status});Object.defineProperty(r,'url',{value:url});return r
}
const gap=/Greyamp|deadline/i
test('Greyamp cancels unread HTTP failures and changed final URLs',async()=>{
 for(const [status,url]of [[503,FIRST_PARTY_CAREERS_URL],[200,'https://example.com/']]){
  let cancelled=false
  await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({cancel(){cancelled=true}}),status,url)}),gap)
  assert.equal(cancelled,true)
 }
})
test('Greyamp bounds streamed bytes before consuming the whole response',async()=>{
 let pulls=0,cancelled=false
 await assert.rejects(run({fetchImpl:async()=>response(new ReadableStream({pull(c){pulls++;if(pulls<=9)c.enqueue(new Uint8Array(1000000));else c.close()},cancel(){cancelled=true}}))}),gap)
 assert.equal(cancelled,true);assert.ok(pulls<=7,`consumed ${pulls} chunks`)
})
test('Greyamp refuses an unbounded text fallback',async()=>{
 let textRead=false,cancelled=false
 await assert.rejects(run({fetchImpl:async()=>({status:200,url:FIRST_PARTY_CAREERS_URL,body:{cancel(){cancelled=true}},text(){textRead=true;return 'Greyamp'}})}),gap)
 assert.equal(textRead,false);assert.equal(cancelled,true)
})
test('Greyamp caller abort cancels a pending source body and preserves its reason',async()=>{
 const c=new AbortController(),reason={caller:true};let started,cancelled=false
 const ready=new Promise(resolve=>{started=resolve})
 const pending=run({signal:c.signal,fetchImpl:async()=>response(new ReadableStream({pull(){started();return new Promise(()=>{})},cancel(){cancelled=true}}))})
 await ready;c.abort(reason);await assert.rejects(pending,e=>e===reason);assert.equal(cancelled,true)
})
test('Greyamp cancels a late response after the aggregate deadline',async()=>{
 let finish,cancelled=false
 const pending=run({timeoutMs:10,fetchImpl:()=>new Promise(resolve=>{finish=resolve})})
 await assert.rejects(pending,gap)
 finish(response(new ReadableStream({cancel(){cancelled=true}})))
 await new Promise(resolve=>setTimeout(resolve,5));assert.equal(cancelled,true)
})
