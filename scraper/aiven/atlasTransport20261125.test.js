import assert from 'node:assert/strict'
import test from 'node:test'
import {setTimeout as delay} from 'node:timers/promises'
import {run} from './script.js'
const listing='https://aiven.io/careers/job'
const response=body=>Object.defineProperty(new Response(body,{headers:{'content-type':'text/html'}}),'url',{value:listing})
const outcome=pending=>pending.then(()=>({returned:true}),reason=>({reason}))
const within=async(pending,ms=100)=>Promise.race([pending,delay(ms).then(()=>({stillPending:true}))])
function stalledBody(onRead,onCancel){
 let settle
 const reader={read(){onRead();return new Promise(resolve=>{settle=resolve})},cancel(){onCancel();settle?.({done:true})},releaseLock(){}}
 return{body:{getReader(){return reader}},finish(){settle?.({done:true})}}
}
const readerResponse=body=>({status:200,url:listing,headers:new Headers({'content-type':'text/html'}),body,bodyUsed:false})

test('Aiven abort during an uncooperative fetch returns the exact caller reason and owns bounded disposal of its later response',async()=>{
 for(const requestedReason of[Object.freeze({owner:'aiven-deferred-fetch'}),null,undefined]){
  const caller=new AbortController();let release,started,cancelled=false,reads=0
  const began=new Promise(resolve=>{started=resolve})
  const pending=outcome(run({signal:caller.signal,requestIntervalMs:0,fetchImpl:()=>{reads++;started();return new Promise(resolve=>{release=resolve})}}))
  await began;caller.abort(requestedReason)
  let result
  try{result=await within(pending)}finally{
   release(response(new ReadableStream({cancel(){cancelled=true}})));await pending;await delay(0)
  }
  assert.equal(result.stillPending,undefined);assert.equal(result.reason,caller.signal.reason)
  assert.equal(reads,1);assert.equal(cancelled,true)
 }
})

test('Aiven abort during an uncooperative body read cancels the owned reader and starts no later request',async()=>{
 for(const requestedReason of[Object.freeze({owner:'aiven-stalled-body'}),null,undefined]){
  const caller=new AbortController();let started,cancelled=false,reads=0
  const began=new Promise(resolve=>{started=resolve})
  const stream=stalledBody(started,()=>{cancelled=true})
  const pending=outcome(run({signal:caller.signal,requestIntervalMs:0,fetchImpl:async()=>{reads++;return readerResponse(stream.body)}}))
  await began;caller.abort(requestedReason)
  let result
  try{result=await within(pending)}finally{stream.finish();await pending}
  assert.equal(result.stillPending,undefined);assert.equal(result.reason,caller.signal.reason)
  assert.equal(reads,1);assert.equal(cancelled,true)
 }
})

test('Aiven request and source deadlines independently end pending fetch and body waits with owned cleanup',async()=>{
 for(const mode of['fetch','body'])for(const boundary of['request','source']){
  let started,release,cancelled=false,reads=0
  const began=new Promise(resolve=>{started=resolve})
  const stream=mode==='body'?stalledBody(started,()=>{cancelled=true}):null
  const pending=outcome(run({requestIntervalMs:0,requestTimeoutMs:boundary==='request'?20:1000,timeoutMs:boundary==='source'?20:1000,
   fetchImpl:()=>{reads++;if(mode==='fetch')started();return mode==='fetch'?new Promise(resolve=>{release=resolve}):readerResponse(stream.body)}}))
  await began;let result
  try{result=await within(pending,150)}finally{
   if(mode==='fetch'){release(readerResponse({cancel(){cancelled=true},getReader(){return{async read(){return{done:true}},releaseLock(){}}}}));await pending;await delay(0)}
   else{stream.finish();await pending}
  }
  assert.equal(result.stillPending,undefined,mode+' '+boundary);assert.equal(result.reason?.name,'TimeoutError',mode+' '+boundary)
  assert.equal(reads,1);assert.equal(cancelled,true)
 }
})
