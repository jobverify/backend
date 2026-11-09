import test from 'node:test'
import assert from 'node:assert/strict'
import {collectPublicSource} from './sourceBoundary.js'

const url='https://www.agentdna.ai/careers'
test('current public reader preserves typed503/429 metadata and never waits on denied body cancellation',async()=>{
 for(const status of [503,429])await assert.rejects(collectPublicSource('agentdna',{fetchPage:async()=>({url,status,headers:{'retry-after':'17'},body:{cancel:()=>new Promise(()=>{})}})},new Set([url]),async context=>context.read(url)),error=>error.status===status&&error.retryDelayMs===17000&&error.softFailure&&error.abortRetries)
})
test('a denied host is cached for the current attempt without another network read',async()=>{
 let calls=0
 await collectPublicSource('agentdna',{fetchPage:async()=>{calls++;return{url,status:403,body:{cancel(){throw Error('cancel')}}}}},new Set([url]),async({read})=>{
  await assert.rejects(read(url),error=>error.status===403);await assert.rejects(read(url),error=>error.status===403)
 });assert.equal(calls,1)
})
test('provided typed HTTP exceptions retain503 retry metadata without becoming an unclassified transport failure',async()=>{
 await assert.rejects(collectPublicSource('agentdna',{fetchPage:async()=>{throw Object.assign(Error('upstream'),{status:503,retryDelayMs:19000})}},new Set([url]),({read})=>read(url)),error=>error.status===503&&error.retryDelayMs===19000&&error.softFailure&&error.upstreamOutage&&error.failureKind==='network_or_timeout')
})
test('opaque caller cancellation bounds ignored readers, bodies and observers and preserves injected signal identity',async()=>{
 for(const stage of ['reader','body','observer']){
  const c=new AbortController(),reason={opaque:stage};let suppliedSignal
  const task=collectPublicSource('agentdna',{signal:c.signal,fetchPage:async(_url,request)=>{suppliedSignal=request.signal;if(stage==='reader')return new Promise(()=>{});return{status:200,url,text:()=>stage==='body'?new Promise(()=>{}):'ok'}},onAudit:()=>stage==='observer'?new Promise(()=>{}):undefined},new Set([url]),async({read,audit})=>{await read(url);await audit({ok:true})})
  setTimeout(()=>c.abort(reason),15);await assert.rejects(task,error=>error===reason);assert.equal(suppliedSignal,c.signal)
 }
})
test('collection deadline bounds ignored collaborators even without a caller signal',async()=>{
 await assert.rejects(collectPublicSource('agentdna',{collectionBudgetMs:15,fetchPage:()=>new Promise(()=>{})},new Set([url]),({read})=>read(url)),/deadline/i)
})
test('async observer rejection is awaited and retains its identity',async()=>{
 const reason=Error('observer rejected');await assert.rejects(collectPublicSource('agentdna',{onAudit:async()=>{throw reason}},new Set([url]),({audit})=>audit({})),error=>error===reason)
})
test('default and injected bodies have the same byte bound and reader cancellation',async()=>{
 const huge='x'.repeat(4*1024*1024+1),native=globalThis.fetch
 for(const defaultTransport of [false,true]){
  const fetcher=async()=>({status:200,url,html:huge});if(defaultTransport)globalThis.fetch=fetcher
  try{await assert.rejects(collectPublicSource('agentdna',defaultTransport?{}:{fetchPage:fetcher},new Set([url]),({read})=>read(url)),/byte bound/i)}finally{globalThis.fetch=native}
 }
})
test('undeclared routes and cross-origin responses fail before source evidence can be emitted',async()=>{
 await assert.rejects(collectPublicSource('agentdna',{},new Set([url]),({read})=>read('https://elsewhere.example/jobs')),/undeclared/i)
 await assert.rejects(collectPublicSource('agentdna',{fetchPage:async()=>({url:'https://elsewhere.example/jobs',status:200,html:'ok'})},new Set([url]),({read})=>read(url)),/response identity/i)
})
