import assert from 'node:assert/strict'
import test from 'node:test'
import {setImmediate} from 'node:timers/promises'
import {createAdidasPublicRead} from './publicRead.js'
import {run} from './script.js'
import {CAREERS} from './nativeModels.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const clock=t=>t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.parse('2026-11-08T10:00:00Z')})
const response=body=>{
 const value=new Response(body,{status:200,headers:{'content-type':'text/html'}})
 Object.defineProperty(value,'url',{value:CAREERS})
 return value
}
const timedOut=(error,milliseconds,url)=>{
 assert.equal(error.name,'TimeoutError')
 assert.equal(error.code,'ETIMEDOUT')
 assert.equal(error.timeoutMs,milliseconds)
 if(url)assert.equal(error.requestUrl,url)
 assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout'})
 assert.notEqual(error.localTimeout,true,'This is the source transport deadline, not the outer runner watchdog')
 return true
}

test('Adidas header deadline is a bounded request timeout, not a parser failure',async t=>{
 clock(t)
 const receipts=[],calls=[]
 const transport=createAdidasPublicRead({minIntervalMs:0,fetchImpl:(url,init)=>{calls.push({url,init});return new Promise(()=>{})}},receipts)
 try{
  const pending=transport.read(CAREERS)
  const rejected=assert.rejects(pending,error=>timedOut(error,20000,CAREERS))
  assert.equal(calls.length,1)
  assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.redirect,'manual')
  assert.equal(calls[0].init.signal.aborted,false)
  t.mock.timers.tick(19999);assert.equal(calls[0].init.signal.aborted,false)
  t.mock.timers.tick(1);await rejected
  assert.equal(calls[0].init.signal.aborted,true)
  assert.equal(receipts.length,0)
  await assert.rejects(transport.read(CAREERS),/stopped source/)
 }finally{transport.close()}
})

test('Adidas body deadline cancels the incomplete stream without inventing a completed response',async t=>{
 clock(t)
 let cancelled=0
 const body=new ReadableStream({pull:()=>new Promise(()=>{}),cancel:()=>{cancelled++}})
 const receipts=[],transport=createAdidasPublicRead({minIntervalMs:0,fetchImpl:async()=>response(body)},receipts)
 try{
  const pending=transport.read(CAREERS),rejected=assert.rejects(pending,error=>timedOut(error,20000,CAREERS))
  await setImmediate()
  assert.equal(receipts.length,1);assert.equal(receipts[0].status,200);assert.equal(receipts[0].bodySHA256,null)
  t.mock.timers.tick(20000);await rejected;await setImmediate()
  assert.equal(cancelled,1)
  assert.equal(receipts[0].bodySHA256,null)
  assert.equal(Object.hasOwn(receipts[0],'rawText'),false)
 }finally{transport.close()}
})

test('Adidas collection deadline retains its own fixed budget and timeout classification',async t=>{
 clock(t)
 let calls=0
 const receipts=[],transport=createAdidasPublicRead({minIntervalMs:0,fetchImpl:async()=>++calls===1?response('<html></html>'):new Promise(()=>{})},receipts)
 try{
  await transport.read(CAREERS)
  assert.equal(receipts.length,1)
  t.mock.timers.tick(179999)
  const pending=transport.read(CAREERS),rejected=assert.rejects(pending,error=>timedOut(error,180000))
  assert.equal(calls,2)
  t.mock.timers.tick(1);await rejected
  assert.equal(receipts.length,1)
  assert.equal(transport.signal.aborted,true)
 }finally{transport.close()}
})

test('Adidas public source preserves incomplete inventory when its first request times out',async t=>{
 clock(t)
 let calls=0
 const pending=run({minIntervalMs:0,fetchImpl:()=>{calls++;return new Promise(()=>{})}})
 const rejected=assert.rejects(pending,error=>{
  timedOut(error,20000,CAREERS)
  const audit=error.recruitmentObservations
  assert.equal(audit.source,'adidas');assert.equal(audit.nativeRecords,null);assert.equal(audit.returnedRecords,0)
  assert.equal(audit.complete,false);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal(audit.responses.length,0);assert.equal(audit.failures.length,1)
  assert.equal(error.inventoryEvidence.status,'coverage-gap');assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null);assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  return true
 })
 t.mock.timers.tick(20000);await rejected
 assert.equal(calls,1)
})

test('Adidas unrelated transport contract errors retain their identity and hard classification',async()=>{
 const reason=Error('Synthetic selector contract rejected')
 const transport=createAdidasPublicRead({minIntervalMs:0,fetchImpl:async()=>{throw reason}},[])
 try{
  await assert.rejects(transport.read(CAREERS),error=>error===reason)
  assert.equal(reason.code,undefined)
  assert.deepEqual(classifyScraperError(reason),{softFailure:false,upstreamOutage:false,failureKind:'parser_or_contract_error'})
 }finally{transport.close()}
})
