import assert from 'node:assert/strict'
import test from 'node:test'
import {getEventListeners} from 'node:events'
import {run,FIRST_PARTY_ROOT_URL} from './script.js'
import {withRetry,getRetryMetadata} from '../../scraper-support/utils/retry.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const never=()=>new Promise(()=>{})
const rejects=async operation=>{
 let failure
 await assert.rejects(operation,error=>{failure=error;return true})
 return failure
}
const timeoutFields=(error,stage)=>{
 assert.equal(error.name,'TimeoutError')
 assert.equal(error.requestUrl,FIRST_PARTY_ROOT_URL)
 assert.equal(error.requestStage,stage)
 assert.equal(error.requestTimeoutMs,10)
 assert.equal(error.abortRetries,true)
 assert.equal(error.failureKind,'network_or_timeout')
 assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout'})
 assert.equal(error.lifecycleCleanupAllowed,false)
 assert.equal(error.inventoryEvidence.listingComplete,false)
 assert.equal(error.inventoryEvidence.reportedTotal,null)
 assert.equal(error.inventoryEvidence.pagesFetched,0)
 assert.deepEqual(error.retainedResponses,[])
}

// Without a separate read deadline, the first blocked public request consumes
// the entire aggregate budget and reaches the retry consumer as a generic gap.
test('StarHealth bounds signal-ignoring never-header requests before the source deadline',async()=>{
 let requestSignal
 const error=await rejects(()=>run({requestTimeoutMs:10,timeoutMs:100,fetchImpl:(_url,options)=>{requestSignal=options.signal;return never()}}))
 timeoutFields(error,'headers')
 assert.equal(requestSignal.aborted,true);assert.equal(requestSignal.reason,error)
})

test('StarHealth bounds signal-ignoring body readers and cleans up with the original timeout reason',async()=>{
 let requestSignal,cancelReason,releases=0,cancels=0
 const error=await rejects(()=>run({requestTimeoutMs:10,timeoutMs:100,fetchImpl:async(url,options)=>{
  requestSignal=options.signal
  return {url,status:200,body:{getReader:()=>({read:never,cancel(reason){cancelReason=reason;cancels++;return never()},releaseLock(){releases++}})}}
 }}))
 timeoutFields(error,'body')
 assert.equal(requestSignal.reason,error);assert.equal(cancelReason,error)
 assert.equal(cancels,1);assert.equal(releases,1)
})

test('StarHealth bounds signal-ignoring text bodies and cancels their response body',async()=>{
 let cancelReason,cancels=0
 const error=await rejects(()=>run({requestTimeoutMs:10,timeoutMs:100,fetchImpl:async url=>({url,status:200,
  body:{cancel(reason){cancelReason=reason;cancels++;return Promise.reject(Error('cleanup failed'))}},text:never})}))
 timeoutFields(error,'body')
 assert.equal(cancelReason,error);assert.equal(cancels,1)
})

test('StarHealth actual retry consumer attempts a stalled source once and retains its network failure',async t=>{
 t.mock.method(console,'warn',()=>{})
 let attempts=0
 const error=await rejects(()=>withRetry(()=>{attempts++;return run({requestTimeoutMs:10,timeoutMs:100,fetchImpl:never})},
  {attempts:4,baseDelayMs:0,label:'starhealth'}))
 assert.equal(attempts,1)
 assert.deepEqual(getRetryMetadata(error),{attemptsUsed:1,retries:0,retryDelayMs:0})
 assert.equal(error.softFailure,true);assert.equal(error.failureKind,'network_or_timeout')
 timeoutFields(error.cause,'headers')
})

test('StarHealth cancels a late response once with the same timeout and removes caller listeners',async()=>{
 const caller=new AbortController(),before=getEventListeners(caller.signal,'abort').length
 let deliver,cancelReason,cancels=0
 const pending=run({signal:caller.signal,requestTimeoutMs:10,timeoutMs:100,fetchImpl:()=>new Promise(resolve=>{deliver=resolve})})
 const error=await rejects(()=>pending)
 timeoutFields(error,'headers')
 assert.equal(getEventListeners(caller.signal,'abort').length,before)
 const response=new Response(new ReadableStream({cancel(reason){cancelReason=reason;cancels++}}))
 Object.defineProperty(response,'url',{value:FIRST_PARTY_ROOT_URL})
 deliver(response)
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancels,1);assert.equal(cancelReason,error)
})

test('StarHealth preserves an earlier aggregate cancellation reason and cleans up the pending read',async()=>{
 let requestSignal
 const error=await rejects(()=>run({requestTimeoutMs:100,timeoutMs:10,fetchImpl:(_url,options)=>{requestSignal=options.signal;return never()}}))
 assert.equal(error.code,'STARHEALTH_COVERAGE_GAP')
 assert.equal(error.message,'StarHealth coverage gap: Aggregate source deadline exceeded')
 assert.equal(requestSignal.reason,error)
 assert.equal(error.requestStage,undefined)
})

test('StarHealth aggregate deadline remains a single failed network attempt through the retry consumer',async t=>{
 t.mock.method(console,'warn',()=>{})
 let attempts=0
 const error=await rejects(()=>withRetry(()=>{attempts++;return run({requestTimeoutMs:100,timeoutMs:10,fetchImpl:never})},
  {attempts:4,baseDelayMs:0,label:'starhealth-aggregate'}))
 assert.equal(attempts,1)
 assert.deepEqual(getRetryMetadata(error),{attemptsUsed:1,retries:0,retryDelayMs:0})
 assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'network_or_timeout'})
 assert.equal(error.cause.message,'StarHealth coverage gap: Aggregate source deadline exceeded')
})

test('StarHealth rejects read budgets outside the project twenty-second request bound before fetching',async()=>{
 for(const requestTimeoutMs of [0,20001,1.5]){
  await assert.rejects(()=>run({requestTimeoutMs,fetchImpl:async()=>assert.fail('Invalid request budget reached the network')}),/Invalid HTTP read budget/)
 }
})
