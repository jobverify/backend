import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {setTimeout as delay} from 'node:timers/promises'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {getRetryMetadata,withRetry} from '../../scraper-support/utils/retry.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'
import {CORPORATE,BOARD,API,REMOTE_ENTRY,APP} from './nativeContract.js'
import {runNativeIndigo} from './nativeRun.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-inventory-20261106.json.gz',import.meta.url))))
const defaults={timeoutMs:120,requestTimeoutMs:15}
const never=()=>new Promise(()=>{})
const response=(url,body='')=>({status:200,url,text:async()=>body})
const timeout=(error,stage)=>{
 assert.equal(error.name,'TimeoutError')
 assert.equal(error.code,'INDIGO_HTTP_READ_TIMEOUT')
 assert.equal(error.source,'indigo')
 assert.equal(error.requestUrl,CORPORATE)
 assert.equal(error.stage,stage)
 assert.equal(error.timeoutMs,15)
 assert.equal(error.failureKind,'network_or_timeout')
 assert.equal(error.abortRetries,true)
 assert.match(error.message,new RegExp(stage))
 assert.ok(error.message.includes(CORPORATE))
 return true
}

test('Indigo aborts a signal-ignoring fetch at its separate HTTP headers deadline',async()=>{
 let transportSignal,calls=0
 await assert.rejects(runNativeIndigo({...defaults,fetchImpl:(_url,init)=>{calls++;transportSignal=init.signal;return never()}}),error=>{
  timeout(error,'headers')
  assert.equal(transportSignal.aborted,true)
  assert.equal(transportSignal.reason,error)
  return true
 })
 assert.equal(calls,1)
})

test('Indigo aborts and cleans a signal-ignoring response body at its HTTP body deadline',async()=>{
 let transportSignal,cancels=0,cancelReason
 await assert.rejects(runNativeIndigo({...defaults,fetchImpl:async(url,init)=>{
  transportSignal=init.signal
  return{...response(url),body:{cancel:reason=>{cancels++;cancelReason=reason}},text:never}
 }}),error=>{
  timeout(error,'body')
  assert.equal(transportSignal.aborted,true)
  assert.equal(transportSignal.reason,error)
  assert.equal(cancels,1)
  assert.equal(cancelReason,error)
  return true
 })
})

test('Indigo cancels and unlocks an actual stalled Response body with its exact read timeout',async()=>{
 let body,cancels=0,cancelReason
 await assert.rejects(runNativeIndigo({...defaults,fetchImpl:async url=>{
  body=new ReadableStream({cancel(reason){cancels++;cancelReason=reason}})
  const actual=new Response(body)
  Object.defineProperty(actual,'url',{value:url})
  return actual
 }}),error=>{
  timeout(error,'body')
  assert.equal(cancels,1)
  assert.equal(cancelReason,error)
  assert.equal(body.locked,false)
  return true
 })
})

test('registered Indigo read timeout stops the existing four-attempt retry policy after one attempt',async t=>{
 t.mock.method(console,'warn',()=>{})
 const source=createCatalogScraper(getScraperCatalog().find(p=>p.source==='indigo'))
 let calls=0
 await assert.rejects(withRetry(()=>source.run({...defaults,fetchImpl:()=>{calls++;return never()}}),{
  attempts:4,baseDelayMs:1,label:'indigo-read-regression',
 }),error=>{
  assert.deepEqual(getRetryMetadata(error),{attemptsUsed:1,retries:0,retryDelayMs:0})
  assert.equal(error.failureKind,'network_or_timeout')
  assert.equal(error.abortRetries,true)
  timeout(error.cause,'headers')
  return true
 })
 assert.equal(calls,1)
})

test('Indigo cancels a late response without reading it after a transport ignored the deadline',async()=>{
 let release,cancels=0,bodies=0,cancelReason
 const pending=runNativeIndigo({...defaults,fetchImpl:()=>new Promise(resolve=>{release=resolve})})
 let failure
 await assert.rejects(pending,error=>{failure=error;return timeout(error,'headers')})
 release({...response(CORPORATE),body:{cancel:reason=>{cancels++;cancelReason=reason}},text:async()=>{bodies++;return ''}})
 await delay(0)
 assert.equal(cancels,1)
 assert.equal(cancelReason,failure)
 assert.equal(bodies,0)
})

for(const stage of ['headers','body'])test('Indigo retains the exact frozen caller reason during '+stage,async()=>{
 const caller=new AbortController(),reason=Object.freeze(Error('controlled caller cancellation'))
 let transportSignal,cancels=0
 const pending=runNativeIndigo({...defaults,requestTimeoutMs:100,signal:caller.signal,fetchImpl:async(url,init)=>{
  transportSignal=init.signal
  if(stage==='headers'){queueMicrotask(()=>caller.abort(reason));return never()}
  return{...response(url),body:{cancel:value=>{assert.equal(value,reason);cancels++}},text:()=>{caller.abort(reason);return never()}}
 }})
 await assert.rejects(pending,error=>error===reason)
 assert.equal(transportSignal.aborted,true)
 assert.equal(transportSignal.reason,reason)
 assert.equal(cancels,stage==='body'?1:0)
})

test('Indigo preserves aggregate source cancellation when it precedes the separate read deadline',async()=>{
 let transportSignal
 await assert.rejects(runNativeIndigo({timeoutMs:15,requestTimeoutMs:100,fetchImpl:(_url,init)=>{
  transportSignal=init.signal;return never()
 }}),error=>{
  assert.equal(error.message,'Indigo source deadline')
  assert.equal(error.code,undefined)
  assert.equal(transportSignal.aborted,true)
  assert.equal(transportSignal.reason,error)
  return true
 })
})

test('Indigo keeps an aggregate deadline as a single failed network attempt',async t=>{
 t.mock.method(console,'warn',()=>{})
 const source=createCatalogScraper(getScraperCatalog().find(p=>p.source==='indigo'))
 let calls=0
 await assert.rejects(withRetry(()=>source.run({timeoutMs:10,requestTimeoutMs:100,fetchImpl:()=>{calls++;return never()}}),{
  attempts:4,baseDelayMs:0,label:'indigo-aggregate-regression',
 }),error=>{
  assert.deepEqual(getRetryMetadata(error),{attemptsUsed:1,retries:0,retryDelayMs:0})
  assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout'})
  assert.equal(error.cause.message,'Indigo source deadline')
  return true
 })
 assert.equal(calls,1)
})

test('Indigo reads real Response streams without changing native text or leaving reader locks',async()=>{
 const bodies=[]
 const jobs=await runNativeIndigo({now:captured.runAt,timeoutMs:5000,requestTimeoutMs:1000,fetchImpl:async url=>{
  const body=url===CORPORATE?captured.corporate:url===BOARD?captured.board:url===REMOTE_ENTRY?captured.remoteEntry:url===APP?captured.app:JSON.stringify(captured.payload)
  const actual=new Response(body)
  Object.defineProperty(actual,'url',{value:url});bodies.push(actual.body)
  return actual
 }})
 assert.equal(jobs.length,14)
 assert.equal(jobs.nativeCollectionEvidence.closingInventoryMatches,true)
 assert.equal(bodies.length,6)
 assert.ok(bodies.every(body=>body.locked===false))
})

test('Indigo completes all six retained native reads and clears each finished HTTP deadline',async()=>{
 const calls=[],signals=[]
 const jobs=await runNativeIndigo({now:captured.runAt,timeoutMs:5000,requestTimeoutMs:25,fetchImpl:async(url,init)=>{
  calls.push(url);signals.push(init.signal)
  const body=url===CORPORATE?captured.corporate:url===BOARD?captured.board:url===REMOTE_ENTRY?captured.remoteEntry:url===APP?captured.app:JSON.stringify(captured.payload)
  return response(url,body)
 }})
 assert.deepEqual(calls,[CORPORATE,BOARD,REMOTE_ENTRY,APP,API,API])
 assert.equal(new Set(signals).size,6,'every HTTP read must have its own independently bounded transport signal')
 assert.equal(jobs.length,14)
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,17)
 assert.equal(jobs.nativeCollectionEvidence.closingInventoryMatches,true)
 await delay(50)
 assert.ok(signals.every(signal=>!signal.aborted),'successful reads must not retain timers that later abort their completed transports')
})

test('Indigo read deadline does not replace immediate HTTP or full client contract failures',async()=>{
 await assert.rejects(runNativeIndigo({...defaults,fetchImpl:async url=>({...response(url),status:403})}),error=>{
  assert.match(error.message,/Native HTTP status or URL changed/)
  assert.equal(error.code,undefined)
  return true
 })
 let calls=0
 await assert.rejects(runNativeIndigo({now:captured.runAt,timeoutMs:5000,requestTimeoutMs:100,fetchImpl:async url=>{
  calls++
  return response(url,url===CORPORATE?captured.corporate:url===BOARD?captured.board:url===REMOTE_ENTRY?captured.remoteEntry:captured.app+'\nchanged')
 }}),error=>{
  assert.match(error.message,/Current native all-response pagination\/apply client changed/)
  assert.equal(error.code,undefined)
  return true
 })
 assert.equal(calls,4)
})

for(const requestTimeoutMs of [0,-1,20001])test('Indigo rejects invalid HTTP read budget '+requestTimeoutMs+' before HTTP',async()=>{
 let calls=0
 await assert.rejects(runNativeIndigo({requestTimeoutMs,fetchImpl:()=>{calls++;throw Error('unexpected HTTP')}}),/Invalid HTTP read deadline/)
 assert.equal(calls,0)
})
